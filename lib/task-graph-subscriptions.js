// Copyright 2014, Renasar Technologies Inc.
/* jslint node: true */

"use strict";

var di = require('di');
var uuid = require('node-uuid');

module.exports = SubscriberFactory;

di.annotate(SubscriberFactory, new di.Provide('TaskGraph.Subscriptions'));
di.annotate(SubscriberFactory, new di.Inject(
        'Protocol.TaskGraphRunner',
        'Assert',
        'Q',
        '_',
        'TaskGraph.TaskGraph'
    )
);

function TaskGraphStore (){
    this.store = {};
}
TaskGraphStore.prototype.put = function(name, value) {
    this.store[name] = value;
};
TaskGraphStore.prototype.get = function(name) {
    return this.store[name];
};
TaskGraphStore.prototype.getAll = function(name) {
    return _.values(this.store);
};
TaskGraphStore.prototype.remove = function(name) {
    delete this.store[id];
    return this;
};

var definitionStore = new TaskGraphStore();
var runningInstanceStore = new TaskGraphStore();

function SubscriberFactory(tgrProtocol, assert, Q, _, TaskGraph) {
    function Subscriber() {
        this.subscriptions = [];
    }

    Subscriber.prototype.start = function start() {
        var self = this;
        return Q.all([
            tgrProtocol.subscribeGetTaskGraphLibrary(self.getTaskGraphLibrary),
            tgrProtocol.subscribeGetActiveTaskGraphs(self.getActiveTaskGraphs),
            tgrProtocol.subscribeDefineTaskGraph(self.defineTaskGraph),
            tgrProtocol.subscribeRunTaskGraph(self.runTaskGraph),
            tgrProtocol.subscribeCancelTaskGraph(self.cancelTaskGraph),
            tgrProtocol.subscribePauseTaskGraph(self.pauseTaskGraph),
            tgrProtocol.subscribeResumeTaskGraph(self.resumeTaskGraph),
        ])
        .spread(function() {
            _.forEach(arguments, function(subscription) {
                self.subscriptions.push(subscription);
            });
        });
    };

    Subscriber.prototype.getTaskGraphLibrary = function getTaskGraphLibrary(filter) {
        //TODO: implement filter once design is agreed, for now return all
        return definitionStore.getAll();
    };

    Subscriber.prototype.getActiveTaskGraphs = function getActiveTaskGraphs(filter) {
        var allRunning = runningInstanceStore.getAll();
        var status = _.map(allRunning, function(i){return i.status();});
        return status;
    };

    Subscriber.prototype.defineTaskGraph = function defineTaskGraph(definition) {
        assert.object(definition);
        definitionStore.put(definition.uniqueName, definition);
    };

    Subscriber.prototype.runTaskGraph = function runTaskGraph(uniqueName, options) {
        var taskGraphDefinition = definitionStore.get(uniqueName);
        var taskGraph = new TaskGraph.create(definition, options);
        runningInstanceStore.put(taskGraph.id, taskGraph);
        taskGraph.on('complete', function(){
            runningInstanceStore.remove(taskgraph.id);
        });
        taskGraph.start();
        return taskGraph.id;
    };

    Subscriber.prototype.cancelTaskGraph = function cancelTaskGraph(instanceId) {
        var instance = runningInstanceStore.get(instanceId);
        runningInstanceStore.remove(instanceId);
        instance.cancel();
    };

    Subscriber.prototype.pauseTaskGraph = function pauseTaskGraph(instanceId) {
        var instance = runningInstanceStore.get(instanceId);
        instance.pause();
    };

    Subscriber.prototype.resumeTaskGraph = function resumeTaskGraph(instanceId) {
        var instance = runningInstanceStore.get(instanceId);
        instance.resume();
    };

    Subscriber.prototype.stop = function stop() {
        var self = this;
        return Q.all(_.map(self.subscriptions, function(subscription) {
            return subscription.dispose();
        }));
    };

    return new Subscriber();
}
