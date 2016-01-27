// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di'),
    _ = require('lodash'),
    core = require('on-core')(di),
    injector = new di.Injector(
        _.flattenDeep([
            core.injectables,
            core.workflowInjectables,
            require('on-tasks').injectables,
            require('./lib/task-graph-runner.js'),
            require('./lib/task-runner.js'),
            require('./lib/loader.js'),
            require('./lib/task-scheduler.js'),
            require('./lib/lease-expiration-poller.js'),
            require('./lib/service-graph.js'),
            require('./lib/completed-task-poller.js'),
            require('./lib/rx-mixins.js')
        ])
    ),
    taskGraphRunner = injector.get('TaskGraph.Runner'),
    logger = injector.get('Logger').initialize('TaskGraph');

var options = {
    runner: true,
    scheduler: true
};

if (_.contains(process.argv, '-s') || _.contains(process.argv, '--scheduler')) {
    options.runner = false;
} else if (_.contains(process.argv, '-r') || _.contains(process.argv, '--runner')) {
    options.scheduler = false;
}

taskGraphRunner.start(options)
    .then(function () {
        logger.info('Task Graph Runner Started.');
    })
    .catch(function(error) {
        //NOTE(heckj): I'm unclear why this is on the console directly and not
        // using a logger. Would expect this to be logger.critical(), but
        // leaving as is because I don't know the implications.
        console.error(error.message || error.details);
        console.error(error.stack || error.rawStack);
//      logger.critical('Task Graph Runner Startup Error.', { error: error });

        process.nextTick(function() {
            process.exit(1);
        });
    });

process.on('SIGINT', function() {
    taskGraphRunner.stop()
        .catch(function(error) {
            logger.critical('Task Graph Runner Shutdown Error.', { error: error });
        })
        .finally(function() {
            process.nextTick(function() {
                process.exit(1);
            });
        });
    });
