// Copyright 2014, Renasar Technologies Inc.
/* jshint: node:true */

'use strict';

var di = require('di');

module.exports = Runner;

di.annotate(Runner, new di.Provide('TaskGraph.Runner'));
di.annotate(Runner, new di.Inject(
        'Services.Core',
        'TaskGraph.Subscriptions',
        'TaskGraph.Registry',
        'TaskGraph.DataLoader'
    )
);
function Runner(core, taskGraphSubscriptions, taskGraphRegistry, dataLoader) {
    function start() {
        return core.start().then(function() {
            return dataLoader.start();
        }).then(function() {
            return taskGraphSubscriptions.start();
        }).then(function() {
            return taskGraphRegistry.start();
        });
    }

    function stop() {
        return taskGraphRegistry.stop().then(function() {
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
