// Copyright 2015, EMC, Inc.
/* jshint: node:true */

'use strict';

var di = require('di');

module.exports = Runner;

di.annotate(Runner, new di.Provide('TaskGraph.Runner'));
di.annotate(Runner, new di.Inject(
        'Services.Core',
        'TaskGraph.Subscriptions',
        'TaskGraph.Registry',
        'TaskGraph.DataLoader',
        'TaskGraph.Scheduler',
        'TaskGraph.ServiceGraph'
    )
);
function Runner(core, taskGraphSubscriptions, registry, dataLoader, scheduler, serviceGraph) {
    function start() {
        return core.start().then(function() {
            return registry.start();
        }).then(function() {
            return dataLoader.start();
        }).then(function() {
            return taskGraphSubscriptions.start();
        }).then(function() {
            return scheduler.start();
        }).then(function() {
            return serviceGraph.start();
        });
    }

    function stop() {
        return scheduler.stop().then(function() {
            return serviceGraph.stop();
        }).then(function() {
            return taskGraphSubscriptions.stop();
        }).then(function() {
            return core.stop();
        });
    }

    return {
        start: start,
        stop: stop
    };
}
