// Copyright 2014, Renasar Technologies Inc.
/* jslint node: true */

"use strict";

var di = require('di');

module.exports = SubscriberFactory;

di.annotate(SubscriberFactory, new di.Provide('TaskGraph.Subscriptions'));
di.annotate(SubscriberFactory, new di.Inject(
        'Protocol.TaskGraphRunner',
        'Q',
        '_'
    )
);

function SubscriberFactory(tgrProtocol, Q, _) {
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

    Subscriber.prototype.getTaskGraphLibrary = function getTaskGraphLibrary() {
    };

    Subscriber.prototype.getActiveTaskGraphs = function getActiveTaskGraphs() {
    };

    Subscriber.prototype.defineTaskGraph = function defineTaskGraph() {
    };

    Subscriber.prototype.runTaskGraph = function runTaskGraph() {
    };

    Subscriber.prototype.cancelTaskGraph = function cancelTaskGraph() {
    };

    Subscriber.prototype.pauseTaskGraph = function pauseTaskGraph() {
    };

    Subscriber.prototype.resumeTaskGraph = function resumeTaskGraph() {
    };

    Subscriber.prototype.stop = function stop() {
        var self = this;
        return Q.all(_.map(self.subscriptions, function(subscription) {
            return subscription.dispose();
        }));
    };

    return new Subscriber();
}
