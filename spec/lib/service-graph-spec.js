// Copyright 2015, EMC, Inc.
/* jshint node:true */

'use strict';

require('../helper');

var di = require('di'),
    uuid = require('node-uuid');


di.annotate(mockRegistryFactory, new di.Provide('TaskGraph.Registry'));
function mockRegistryFactory() {
    var createStub = sinon.stub();
    var startStub = sinon.stub().resolves();
    var serviceGraphUuid = uuid.v4();
    var stopStub = sinon.stub();
    var emitterStub = sinon.stub();

    function MockRegistry() {
        this.createStub = createStub;
        this.startStub = startStub;
        this.serviceGraphUuid = serviceGraphUuid;
        this.stopStub = stopStub;
        this.emitterStub = emitterStub;
    }

    MockRegistry.prototype.fetchGraphDefinitionCatalog = sinon.stub().resolves([
        { injectableName: 'Test Service Graph', serviceGraph: true }
    ]);

    MockRegistry.prototype.fetchGraphHistory = sinon.stub().resolves([
        { instanceId: serviceGraphUuid, injectableName: 'Test Service Graph', serviceGraph: true }
    ]);

    MockRegistry.prototype.fetchGraphSync = sinon.stub().returns({
        create: createStub.returns({
                    start: startStub,
                    on: emitterStub,
                    completeEventString: 'testcomplete',
                    definition: { injectableName: 'Test Service Graph' }
                })
        }
    );

    MockRegistry.prototype.fetchActiveGraphsSync = sinon.stub().returns([
        { injectableName: 'Test Service Graph', serviceGraph: true, stop: stopStub }
    ]);

    return new MockRegistry();
}

describe('Service Graph', function () {
    var serviceGraph;
    var registry;

    beforeEach(function() {
        helper.setupInjector(
            _.flatten([
                mockRegistryFactory,
                helper.require('/lib/service-graph')
            ])
        );
        serviceGraph = helper.injector.get('TaskGraph.ServiceGraph');
        registry = helper.injector.get('TaskGraph.Registry');
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
        _.forEach(registry.fetchActiveGraphsSync(), function(graph) {
            graph.on = sinon.stub();
        });
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
        _.forEach(registry.fetchActiveGraphsSync(), function(graph) {
            graph.on = sinon.stub();
        });
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
            { create: registry.createStub },
            { create: registry.createStub },
            { create: registry.createStub }
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
            { create: registry.createStub },
            { create: registry.createStub },
            { create: registry.createStub }
        );

        return serviceGraph.start()
        .then(function() {
            expect(registry.fetchGraphSync).to.have.been.calledThrice;
            expect(registry.createStub).to.have.been.calledThrice;
            expect(registry.startStub).to.have.been.calledThrice;
        });
    });

    it('should restart service graphs that finish', function() {
        var createStub = registry.fetchGraphSync().create;
        var graph = createStub();
        registry.fetchGraphSync.reset();
        createStub.reset();
        return serviceGraph._createAndRunServiceGraph(
            { injectableName: 'Test Service Graph Restartable' }, {}
        )
        .then(function() {
            expect(registry.fetchGraphSync).to.have.been.calledOnce;
            expect(createStub).to.have.been.calledOnce;
            expect(graph.start).to.have.been.calledOnce;
            expect(graph.on).to.have.been.calledOnce;
            expect(graph.on).to.have.been.calledWith(graph.completeEventString);
            var cb = graph.on.firstCall.args[1];
            expect(cb).to.be.a('function');

            return cb();
        })
        .then(function() {
            expect(registry.fetchGraphSync).to.have.been.calledTwice;
            expect(createStub).to.have.been.calledTwice;
            expect(graph.start).to.have.been.calledTwice;
            expect(graph.on).to.have.been.calledTwice;
            var cb = graph.on.firstCall.args[1];

            return cb();
        })
        .then(function() {
            expect(registry.fetchGraphSync).to.have.been.calledThrice;
            expect(createStub).to.have.been.calledThrice;
            expect(graph.start).to.have.been.calledThrice;
            expect(graph.on).to.have.been.calledThrice;
        });
    });
});
