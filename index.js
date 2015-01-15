// Copyright 2014, Renasar Technologies Inc.
/* jshint: node:true */

'use strict';

var di = require('di'),
    _ = require('lodash'),
    core = require('renasar-core')(di),
    injector = new di.Injector(
        _.flatten([
            core.injectables,
            require('./lib/app'),
            require('./lib/task-graph-runner')
        ])
    ),
    taskGraphRunner = injector.get('TaskGraph.Runner'),
    logger = injector.get('Logger').initialize('TaskGraph.Runner');

taskGraphRunner.start()
    .then(function () {
        logger.info('Task Graph Runner Started.');
    })
    .catch(function(error) {
        logger.error('Task Graph Runner Startup Error.', { error: error });

        process.nextTick(function() {
            process.exit(1);
        });
    });

process.on('SIGINT', function() {
    taskGraphRunner.stop()
        .catch(function(error) {
            logger.error('Task Graph Runner Shutdown Error.', { error: error });
        })
        .fin(function() {
            process.nextTick(function() {
                process.exit(1);
            });
        });
});
