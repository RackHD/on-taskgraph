// Copyright 2014, Renasar Technologies Inc.
/* jslint node: true */

"use strict";

var di = require('di');

module.exports = SubscriberFactory;

di.annotate(SubscriberFactory, new di.Provide('TaskGraph.Subscriptions'));
di.annotate(SubscriberFactory, new di.Inject(
        'Protocol.TaskGraphRunner',
        'TaskGraph.Registry',
        'Assert',
        'Q',
        '_'
    )
);

function SubscriberFactory(tgrProtocol, registry, assert, Q, _) {
    function Subscriber() {
        this.subscriptions = [];
    }

    Subscriber.prototype.start = function start() {
        var self = this;
        return Q.all([
            tgrProtocol.subscribeGetTaskGraphLibrary(self.getTaskGraphLibrary),
            tgrProtocol.subscribeGetActiveTaskGraph(self.getActiveTaskGraph),
            tgrProtocol.subscribeGetActiveTaskGraphs(self.getActiveTaskGraphs),
            tgrProtocol.subscribeDefineTaskGraph(self.defineTaskGraph),
            tgrProtocol.subscribeRunTaskGraph(self.runTaskGraph),
            tgrProtocol.subscribeCancelTaskGraph(self.cancelTaskGraph),
            tgrProtocol.subscribePauseTaskGraph(self.pauseTaskGraph),
            tgrProtocol.subscribeResumeTaskGraph(self.resumeTaskGraph),
            tgrProtocol.subscribeGetTaskGraphProperties(self.getTaskGraphProperties),
            tgrProtocol.subscribeRequestTasks(self.requestTasks),
            tgrProtocol.subscribePublishTasks(self.publishTasks)
        ])
        .spread(function() {
            _.forEach(arguments, function(subscription) {
                self.subscriptions.push(subscription);
            });
        });
    };

    Subscriber.prototype.stop = function stop() {
        var self = this;
        return Q.all(_.map(registry.fetchActiveGraphs(), function(taskGraph) {
            return taskGraph.stop();
        })).then(function() {
            return Q.all(_.map(self.subscriptions, function(subscription) {
                return subscription.dispose();
            }));
        });
    };

    Subscriber.prototype.getTaskGraphLibrary = function getTaskGraphLibrary(filter) {
        return registry.fetchGraphCatalog(filter);
    };

    Subscriber.prototype.getActiveTaskGraph = function getActiveTaskGraph(filter) {
        var graph = registry.fetchActiveGraph(filter);
        return graph ? graph.status() : undefined;
    };

    Subscriber.prototype.getActiveTaskGraphs = function getActiveTaskGraphs(filter) {
        var allRunning = registry.fetchActiveGraphs(filter);
        var _status = _.map(allRunning, function(i){return i.status();});
        return _status;
    };

    Subscriber.prototype.defineTaskGraph = function defineTaskGraph(definition) {
        assert.object(definition);
        registry.putGraph(definition.uniqueName, definition);
    };

    Subscriber.prototype.runTaskGraph = function runTaskGraph(uniqueName, options, target) {
        var context = {
            target: target
        };
        var taskGraph = registry.fetchGraph(uniqueName).create(options, context);
        // TODO: Make serializable errors that can get thrown on the other end
        // for the presenter, or at least some mechanism for doing HTTP errors here
        try {
            registry.putActiveGraph(taskGraph, target);
            taskGraph.start();
        } catch (e) {
            return e.toString();
        }
        return taskGraph.instanceId;
    };

    Subscriber.prototype.cancelTaskGraph = function cancelTaskGraph(instanceId) {
        var instance = registry.fetchActiveGraphs({ instanceId: instanceId });
        if (instance) {
            instance.cancel();
        }
    };

    Subscriber.prototype.pauseTaskGraph = function pauseTaskGraph(instanceId) {
        var instance = registry.fetchActiveGraphs({ instanceId: instanceId });
        assert.object(instance);
        instance.pause();
    };

    Subscriber.prototype.resumeTaskGraph = function resumeTaskGraph(instanceId) {
        var instance = registry.fetchActiveGraphs({ instanceId: instanceId });
        assert.object(instance);
        instance.resume();
    };

    return new Subscriber();
}
