// Copyright 2014, Renasar Technologies Inc.
/* jslint node: true */

"use strict";

var di = require('di');

module.exports = SubscriberFactory;

di.annotate(SubscriberFactory, new di.Provide('TaskGraph.Runner'));
di.annotate(SubscriberFactory, new di.Inject(
        'Protocol.TaskGraphRunner',
        'Q',
        'Logger',
        '_'
    )
);

function SubscriberFactory(tgrProtocol, Q, Logger, _) {
    var logger = Logger.initialize(SubscriberFactory);

    function Subscriber() {
        this.subscriptions = [];
    }

    Subscriber.prototype.start = function start() {
        var self = this;
        return Q.all([
            // subscribe here
        ])
        .spread(function() {
            // register subscriptions here
        });
    };

    /*
    Subscriber.prototype.example = function sample() {
    };
    */

    Subscriber.prototype.stop = function stop() {
        var self = this;
        return Q.all(_.map(self.subscriptions, function(subscription) {
            return subscription.dispose();
        }));
    };

    return new Subscriber();
}
