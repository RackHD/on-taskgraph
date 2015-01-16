// Copyright 2014, Renasar Technologies Inc.
/* jshint: node:true */

'use strict';

var di = require('di');

module.exports = Runner;

di.annotate(Runner, new di.Provide('TaskGraph'));
di.annotate(Runner, new di.Inject(
        'Services.Core',
        'TaskGraph.Runner',
        'TaskGraph.Registry',
        'TaskGraph.GraphLoader'
    )
);
function Runner(core, taskGraphRunner, taskGraphRegistry, taskGraphLoader) {
    function start() {
        return core.start().then(function() {
            debugger;
            return taskGraphLoader.start();
        }).then(function() {
            return taskGraphRunner.start();
        }).then(function() {
            return taskGraphRegistry.start();
        });
    }

    function stop() {
        return taskGraphRegistry.stop().then(function() {
        }).then(function() {
            return taskGraphRunner.stop();
        }).then(function() {
            return core.stop();
        });
    }

    return {
        start: start,
        stop: stop
    };
}
