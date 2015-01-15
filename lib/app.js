// Copyright 2014, Renasar Technologies Inc.
/* jshint: node:true */

'use strict';

var di = require('di');

module.exports = Runner;

di.annotate(Runner, new di.Provide('Http'));
di.annotate(Runner, new di.Inject(
        'Services.Core',
        'TaskGraph.Runner'
    )
);
function Runner(core, taskGraphRunner) {
    function start() {
        return core.start()
        .then(function() {
            return taskGraphRunner.start();
        });
    }

    function stop() {
        return core.stop();
    }

    return {
        start: start,
        stop: stop
    };
}
