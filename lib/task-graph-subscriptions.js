// Copyright 2014, Renasar Technologies Inc.
/* jslint node: true */

"use strict";

var di = require('di');

module.exports = SubscriberFactory;

di.annotate(SubscriberFactory, new di.Provide('TaskGraph.Subscriptions'));
di.annotate(SubscriberFactory, new di.Inject(
        'Protocol.TaskGraphRunner',
        'Assert',
        'Q',
        '_'
    )
);

function SubscriberFactory(tgrProtocol, assert, Q, _) {
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

    Subscriber.prototype.getTaskGraphLibrary = function getTaskGraphLibrary(filter) {
    };

    Subscriber.prototype.getActiveTaskGraphs = function getActiveTaskGraphs(filter) {
    };

    Subscriber.prototype.defineTaskGraph = function defineTaskGraph(definition) {
        assert.object(definition);
    };

    Subscriber.prototype.runTaskGraph = function runTaskGraph(name, options) {
    };

    Subscriber.prototype.cancelTaskGraph = function cancelTaskGraph(instance) {
    };

    Subscriber.prototype.pauseTaskGraph = function pauseTaskGraph(instance) {
    };

    Subscriber.prototype.resumeTaskGraph = function resumeTaskGraph(instance) {
    };

    Subscriber.prototype.getTaskGraphProperties = function requestProperties(instance) {
    };

    Subscriber.prototype.getTasks = function getTasks(instance) {
    };

    Subscriber.prototype.publishTasks = function publishTasks(instance) {
    };

    Subscriber.prototype.stop = function stop() {
        var self = this;
        return Q.all(_.map(self.subscriptions, function(subscription) {
            return subscription.dispose();
        }));
    };

    return new Subscriber();
}
