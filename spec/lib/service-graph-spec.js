// Copyright 2014, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

require('../helper');

var di = require('di'),
    _ = require('lodash'),
    uuid = require('node-uuid');


di.annotate(mockRegistryFactory, new di.Provide('TaskGraph.Registry'));
function mockRegistryFactory() {
    var createStub = sinon.stub();
    var startStub = sinon.stub();
    var serviceGraphUuid = uuid.v4();
    var stopStub = sinon.stub();
    function MockRegistry() {
        this.createStub = createStub;
        this.startStub = startStub;
        this.serviceGraphUuid = serviceGraphUuid;
        this.stopStub = stopStub;
    }

    MockRegistry.prototype.fetchGraphDefinitionCatalog = sinon.stub().resolves([
        { injectableName: 'Test Service Graph', serviceGraph: true }
    ]);

    MockRegistry.prototype.fetchGraphHistory = sinon.stub().resolves([
        { instanceId: serviceGraphUuid, injectableName: 'Test Service Graph', serviceGraph: true }
    ]);

    MockRegistry.prototype.fetchGraphSync = sinon.stub().returns(
        { create: createStub.returns({ start: startStub }) }
    );

    MockRegistry.prototype.fetchActiveGraphsSync = sinon.stub().returns([
        { injectableName: 'Test Service Graph', serviceGraph: true, stop: stopStub }
    ]);

    return new MockRegistry();
}

describe(require('path').basename(__filename), function () {
    var injector,
        serviceGraph,
        registry;

    beforeEach(function() {
        injector = helper.baseInjector.createChild(
            _.flatten([
                mockRegistryFactory,
                helper.require('/lib/service-graph')
            ])
        );
        serviceGraph = injector.get('TaskGraph.ServiceGraph');
        registry = injector.get('TaskGraph.Registry');
    });

    it('should find service graphs and start them', function() {
        return serviceGraph.start()
        .then(function() {
            expect(registry.fetchGraphDefinitionCatalog)
                .to.have.been.calledWith({ serviceGraph: true});
            expect(registry.fetchGraphHistory).to.have.been.calledWith({ serviceGraph: true});
            expect(registry.createStub).to.have.been.calledOnce;
            expect(registry.startStub).to.have.been.calledOnce;
        });
    });

    it('should start service graphs with previously defined instance IDs', function() {
        return serviceGraph.start()
        .then(function() {
            expect(registry.fetchGraphSync).to.have.been.calledWith('Test Service Graph');
            expect(registry.createStub).to.have.been.calledWith({
                instanceId: registry.serviceGraphUuid
            }, {});
        });
    });

    it('should start service graphs without options.instanceId if there are no ' +
            'pre-existing instances', function() {
        registry.fetchGraphHistory = sinon.stub().resolves([]);
        return serviceGraph.start()
        .then(function() {
            expect(registry.createStub).to.have.been.calledWith({}, {});
        });
    });

    it('should stop service graphs', function() {
        return serviceGraph.start()
        .then(function() {
            return serviceGraph.stop();
        })
        .then(function() {
            expect(registry.stopStub).to.have.been.calledOnce;
        });
    });

    it('should not stop non-service graphs', function() {
        registry.fetchActiveGraphsSync = sinon.stub().returns([
            { injectableName: 'Test Service Graph 1', serviceGraph: true, stop: registry.stopStub },
            { injectableName: 'Test Service Graph 2', serviceGraph: true, stop: registry.stopStub },
            { injectableName: 'Test Non-Service Graph', stop: registry.stopStub }
        ]);
        return serviceGraph.start()
        .then(function() {
            return serviceGraph.stop();
        })
        .then(function() {
            // Failure case is stopStub is called three times instead of two
            expect(registry.stopStub).to.have.been.calledTwice;
        });
    });

    it('should stop multiple service graphs', function() {
        registry.fetchActiveGraphsSync = sinon.stub().returns([
            { injectableName: 'Test Service Graph 1', serviceGraph: true, stop: registry.stopStub },
            { injectableName: 'Test Service Graph 2', serviceGraph: true, stop: registry.stopStub },
            { injectableName: 'Test Service Graph 3', serviceGraph: true, stop: registry.stopStub }
        ]);
        return serviceGraph.start()
        .then(function() {
            return serviceGraph.stop();
        })
        .then(function() {
            expect(registry.stopStub).to.have.been.calledThrice;
        });
    });

    it('should start multiple service graphs', function() {
        registry.fetchGraphDefinitionCatalog = sinon.stub().resolves([
            { injectableName: 'Test Service Graph 1', serviceGraph: true },
            { injectableName: 'Test Service Graph 2', serviceGraph: true },
            { injectableName: 'Test Service Graph 3', serviceGraph: true }
        ]);
        registry.fetchGraphSync = sinon.stub().returns(
            { create: registry.createStub.returns({ start: registry.startStub }) },
            { create: registry.createStub.returns({ start: registry.startStub }) },
            { create: registry.createStub.returns({ start: registry.startStub }) }
        );

        return serviceGraph.start()
        .then(function() {
            expect(registry.fetchGraphSync).to.have.been.calledThrice;
            expect(registry.createStub).to.have.been.calledThrice;
            expect(registry.startStub).to.have.been.calledThrice;
        });
    });

    it('should stop multiple service graphs', function() {
        registry.fetchGraphDefinitionCatalog = sinon.stub().resolves([
            { injectableName: 'Test Service Graph 1', serviceGraph: true },
            { injectableName: 'Test Service Graph 2', serviceGraph: true },
            { injectableName: 'Test Service Graph 3', serviceGraph: true }
        ]);
        registry.fetchGraphSync = sinon.stub().returns(
            { create: registry.createStub.returns({ start: registry.startStub }) },
            { create: registry.createStub.returns({ start: registry.startStub }) },
            { create: registry.createStub.returns({ start: registry.startStub }) }
        );

        return serviceGraph.start()
        .then(function() {
            expect(registry.fetchGraphSync).to.have.been.calledThrice;
            expect(registry.createStub).to.have.been.calledThrice;
            expect(registry.startStub).to.have.been.calledThrice;
        });
    });
});
