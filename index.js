// Copyright 2014, Renasar Technologies Inc.
/* jshint: node:true */

'use strict';

var di = require('di'),
    _ = require('lodash'),
    core = require('renasar-core')(di),
    injector = new di.Injector(
        _.flatten([
            core.injectables,
            //require('renasar-tasks'),
            require('../renasar-tasks/lib/tasks/abstract-tasks/task'),
            require('./lib/app'),
            require('./lib/task-graph'),
            require('./lib/graphs/graph-loader'),
            require('./lib/task-graph-runner'),
            require('./lib/scheduler'),
            require('./lib/registry')
        ])
    ),
    taskGraphService = injector.get('TaskGraph'),
    logger = injector.get('Logger').initialize('TaskGraph');


debugger;
taskGraphService.start()
    .then(function () {
        logger.info('Task Graph Runner Started.');
    })
    .catch(function(error) {
        console.error(error);
        logger.error('Task Graph Runner Startup Error.', { error: error });

        process.nextTick(function() {
            process.exit(1);
        });
    });

process.on('SIGINT', function() {
    taskGraphService.stop()
        .catch(function(error) {
            logger.error('Task Graph Runner Shutdown Error.', { error: error });
        })
        .fin(function() {
            process.nextTick(function() {
                process.exit(1);
            });
        });
});
