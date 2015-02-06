// Copyright 2014, Renasar Technologies Inc.
/* jslint node: true */

"use strict";

var di = require('di');

module.exports = SubscriberFactory;

di.annotate(SubscriberFactory, new di.Provide('TaskGraph.Subscriptions'));
di.annotate(SubscriberFactory, new di.Inject(
        'Protocol.TaskGraphRunner',
        'TaskGraph.Registry',
        'TaskGraph.TaskGraph',
        'Task.Task',
        'Assert',
        'Q',
        '_'
    )
);

function SubscriberFactory(tgrProtocol, registry, TaskGraph, Task, assert, Q, _) {
    function Subscriber() {
        this.subscriptions = [];
    }

    Subscriber.prototype.start = function start() {
        var self = this;
        return Q.all([
            tgrProtocol.subscribeGetTaskGraphLibrary(self.getTaskGraphLibrary),
            tgrProtocol.subscribeGetTaskLibrary(self.getTaskLibrary),
            tgrProtocol.subscribeGetActiveTaskGraph(self.getActiveTaskGraph),
            tgrProtocol.subscribeGetActiveTaskGraphs(self.getActiveTaskGraphs),
            tgrProtocol.subscribeDefineTaskGraph(self.defineTaskGraph),
            tgrProtocol.subscribeDefineTask(self.defineTask),
            tgrProtocol.subscribeRunTaskGraph(self.runTaskGraph),
            tgrProtocol.subscribeCancelTaskGraph(self.cancelTaskGraph),
            tgrProtocol.subscribePauseTaskGraph(self.pauseTaskGraph),
            tgrProtocol.subscribeResumeTaskGraph(self.resumeTaskGraph)
        ])
        .spread(function() {
            _.forEach(arguments, function(subscription) {
                self.subscriptions.push(subscription);
            });
        });
    };

    Subscriber.prototype.stop = function stop() {
        var self = this;

        var taskGraphs = registry.fetchActiveGraphsSync();

        return Q.all(_.map(taskGraphs, function(taskGraph) {
            return taskGraph.stop();
        })).then(function() {
            return Q.all(_.map(self.subscriptions, function(subscription) {
                return subscription.dispose();
            }));
        });
    };

    Subscriber.prototype.getTaskGraphLibrary = function getTaskGraphLibrary(filter) {
        return registry.fetchGraphDefinitionCatalog(filter);
    };

    Subscriber.prototype.getTaskLibrary = function getTaskLibrary(filter) {
        return registry.fetchTaskDefinitionCatalog(filter);
    };

    Subscriber.prototype.getActiveTaskGraph = function getActiveTaskGraph(filter) {
        var graph = registry.fetchActiveGraphSync(filter);
        return graph ? graph.status() : undefined;
    };

    Subscriber.prototype.getActiveTaskGraphs = function getActiveTaskGraphs(filter) {
        var allRunning = registry.fetchActiveGraphsSync(filter);
        var _status = _.map(allRunning, function(i){return i.status();});
        return _status;
    };

    Subscriber.prototype.defineTask = function defineTask(definition) {
        try {
            assert.object(definition);
            assert.string(definition.injectableName);
            var taskObj = Task.createRegistryObject(definition);
            registry.registerTask(taskObj);
            return Q.resolve(definition.injectableName);
        } catch (e) {
            return Q.reject(e);
        }
    };

    Subscriber.prototype.defineTaskGraph = function defineTaskGraph(definition) {
        try {
            assert.object(definition);
            assert.string(definition.injectableName);
            var graphObj = TaskGraph.createRegistryObject(definition);
            registry.registerGraph(graphObj);
            return Q.resolve(definition.injectableName);
        } catch (e) {
            return Q.reject(e);
        }
    };

    Subscriber.prototype.runTaskGraph = function runTaskGraph(uniqueName, options, target) {
        var context = {};
        if (target) {
            context.target = target;
            var activeGraph = registry.hasActiveGraphSync(target);
            if (activeGraph) {
                return "Unable to run multiple task graphs against a single target.";
            }
        }

        return registry.fetchGraphDefinitionCatalog()
        .then(function(graphLibrary) {
            var exists = _.some(graphLibrary, function(definition) {
                return uniqueName === definition.injectableName ||
                        uniqueName === definition.friendlyName;
            });
            if (!exists) {
                throw new Error("Graph with name " + uniqueName + " does not exist.");
            }
            var taskGraph = registry.fetchGraphSync(uniqueName).create(options, context);
            // TODO: Make serializable errors that can get thrown on the other end
            // for the presenter, or at least some mechanism for doing HTTP errors here
            if (target) {
                registry.putActiveGraphSync(taskGraph, target);
            }
            return taskGraph.start();
        });
    };

    Subscriber.prototype.cancelTaskGraph = function cancelTaskGraph(filter) {
        assert.object(filter);
        var instance = registry.fetchActiveGraphSync(filter);
        if (instance) {
            var id = instance.instanceId;
            instance.cancel();
            return { instanceId: id };
        }
    };

    Subscriber.prototype.pauseTaskGraph = function pauseTaskGraph(filter) {
        assert.object(filter);
        var instance = registry.fetchActiveGraphSync(filter);
        assert.object(instance);
        instance.pause();
        var id = instance.instanceId;
        return { instanceId: id };
    };

    Subscriber.prototype.resumeTaskGraph = function resumeTaskGraph(filter) {
        assert.object(filter);
        var instance = registry.fetchActiveGraphSync(filter);
        assert.object(instance);
        instance.resume();
        var id = instance.instanceId;
        return { instanceId: id };
    };

    return new Subscriber();
}
