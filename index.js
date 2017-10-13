// Copyright 2017, EMC, Inc.

'use strict';

var di = require('di'),
    _ = require('lodash'),
    consul = require('consul'),
    core = require('on-core')(di),
    helper = core.helper,
    injector = new di.Injector(
        _.flattenDeep([
            core.injectables,
            core.workflowInjectables,
            require('on-tasks').injectables,
            require('./app.js'),
            require('./lib/task-graph-runner.js'),
            require('./lib/task-runner.js'),
            require('./lib/loader.js'),
            require('./lib/task-scheduler.js'),
            require('./lib/lease-expiration-poller.js'),
            require('./lib/service-graph.js'),
            require('./lib/completed-task-poller.js'),
            require('./lib/rx-mixins.js'),
            helper.requireGlob(__dirname + '/lib/services/**/*.js'),
            helper.requireGlob(__dirname + '/api/rest/view/**/*.js'),
            require('./api/rpc/index.js'),
            helper.simpleWrapper(consul, 'consul')
        ])
    ),
    taskGraphRunner = injector.get('TaskGraph.Runner'),
    logger = injector.get('Logger').initialize('TaskGraph');

var restApp = injector.get('rest');

var parseArgs = require('minimist');
var argv = parseArgs(process.argv.slice(2));
var options = {
    runner: true,
    scheduler: true,
    domain: argv.domain || argv.d
};


if (argv.scheduler || argv.s) {
    options.runner = false;
} else if (argv.runner || argv.r) {
    options.scheduler = false;
}

taskGraphRunner.start(options)
     .then(function() {
        return injector.get('Views').load();
     })
     .then(function () {
        logger.info('Task Graph Runner Started.');
        if (options.scheduler) {
             // swaggerRouter configuration
            restApp.start();
        }
     })
    .catch(function (error) {
        //NOTE(heckj): I'm unclear why this is on the console directly and not
        // using a logger. Would expect this to be logger.critical(), but
        // leaving as is because I don't know the implications.
        console.error(error.message || error.details);
        console.error(error.stack || error.rawStack);
        //      logger.critical('Task Graph Runner Startup Error.', { error: error });

        process.nextTick(function () {
            process.exit(1);
        });
    });

process.on('SIGINT', function () {
    taskGraphRunner.stop()
        .catch(function (error) {
            logger.critical('Task Graph Runner Shutdown Error.', { error: error });
        })
        .finally(function () {
            restApp.stop();
            process.nextTick(function () {
                process.exit(1);
            });
        });
});

module.exports = {
    injector: injector,
    taskGraphRunner: taskGraphRunner
};
