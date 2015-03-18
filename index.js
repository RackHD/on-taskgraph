// Copyright 2014, Renasar Technologies Inc.
/* jshint: node:true */

'use strict';

var di = require('di'),
    _ = require('lodash'),
    core = require('on-core')(di),
    tasks = require('on-tasks'),
    injector = new di.Injector(
        _.flatten([
            core.injectables,
            tasks.injectables,
            require('./lib/task-graph'),
            require('./lib/task-graph-runner'),
            require('./lib/task-graph-subscriptions'),
            require('./lib/loader'),
            require('./lib/scheduler'),
            require('./lib/registry'),
            require('./lib/service-graph'),
            require('./lib/stores/memory'),
            require('./lib/stores/waterline')
        ])
    ),
    taskGraphRunner = injector.get('TaskGraph.Runner'),
    logger = injector.get('Logger').initialize('TaskGraph');


taskGraphRunner.start()
    .then(function () {
        logger.info('Task Graph Runner Started.');
    })
    .catch(function(error) {
        console.error(error.message || error.details);
        console.error(error.stack || error.rawStack);
//        logger.error('Task Graph Runner Startup Error.', { error: error });

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
