// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di'),
    _ = require('lodash'),
    core = require('on-core')(di),
    tasks = require('on-tasks'),
    injector = new di.Injector(
        _.flattenDeep([
            core.injectables,
            tasks.injectables,
            require('./lib/task-graph'),
            require('./lib/task-graph-runner'),
            require('./lib/task-runner.js'),
            require('./lib/messenger.js'),
            require('./lib/messengers/messenger-AMQP.js'),
            require('./lib/messengers/messenger-mongo.js'),
            require('./lib/task-graph-subscriptions'),
            require('./lib/store'),
            require('./lib/task-scheduler'),
            require('./lib/loader'),
            require('./lib/scheduler'),
            require('./lib/registry'),
            require('./lib/service-graph'),
            require('./lib/stores/memory'),
            require('./lib/stores/waterline'),
            require('./lib/stores/mongo')
        ])
    ),
    taskGraphRunner = injector.get('TaskGraph.Runner'),
    logger = injector.get('Logger').initialize('TaskGraph');


taskGraphRunner.start()
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
