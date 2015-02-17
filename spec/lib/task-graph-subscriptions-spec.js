// Copyright 2014, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

require('../helper');
var _ = require('lodash');

describe(require('path').basename(__filename), function () {
    var injector;

    beforeEach(function() {
        injector = helper.baseInjector.createChild(
            _.flatten([
                require('renasar-tasks').injectables,
                helper.require('/lib/task-graph-runner'),
                helper.require('/lib/registry'),
                helper.require('/lib/scheduler'),
                helper.require('/lib/stores/memory'),
                helper.require('/lib/stores/waterline'),
                helper.require('/lib/task-graph'),
                helper.require('/lib/task-graph-subscriptions')
            ])
        );
    });

    it('should start', function() {
        var tgrProtocol = injector.get('Protocol.TaskGraphRunner');
        _.forEach(Object.getPrototypeOf(tgrProtocol), function(v, k) {
            tgrProtocol[k] = sinon.stub().resolves({});
        });

        var subscriber = injector.get('TaskGraph.Subscriptions');
        expect(subscriber.subscriptions).to.deep.equal([]);

        return subscriber.start()
        .then(function() {
            expect(subscriber.subscriptions).to.be.an.array;
            expect(subscriber.subscriptions).to.have.length(10);
        });
    });

    it('should stop', function() {
        var disposeStub = sinon.stub();
        var stopStub = sinon.stub();

        var tgrProtocol = injector.get('Protocol.TaskGraphRunner');
        _.forEach(Object.getPrototypeOf(tgrProtocol), function(v, k) {
            tgrProtocol[k] = sinon.stub().resolves({
                dispose: disposeStub
            });
        });

        var registry = injector.get('TaskGraph.Registry');
        registry.fetchActiveGraphsSync = sinon.stub().returns([
            { stop: stopStub }, { stop: stopStub }, { stop: stopStub }
        ]);
        var subscriber = injector.get('TaskGraph.Subscriptions');

        return subscriber.start()
        .then(function() {
            return subscriber.stop();
        })
        .then(function() {
            expect(stopStub).to.have.been.calledThrice;
            expect(disposeStub.callCount).to.equal(10);
        });
    });
});
