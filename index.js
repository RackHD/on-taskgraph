// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di'),
    _ = require('lodash'),
    core = require('on-core')(di),
    helper = core.helper,
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
            require('./lib/rx-mixins.js'),
            helper.requireGlob(__dirname + '/lib/services/**/*.js'),
            helper.requireGlob(__dirname + '/api/rest/view/**/*.js'),
            require('./api/rpc/index.js'),
            helper.requireWrapper('consul', 'consul')
        ])
    ),
    taskGraphRunner = injector.get('TaskGraph.Runner'),
    logger = injector.get('Logger').initialize('TaskGraph');
var app = require('express')();
var http = require('http');
var swaggerTools = require('swagger-tools');
var parseArgs = require('minimist');

var options = {
    runner: true,
    scheduler: true
};

var httpPort = 9005;
var server;

var argv = parseArgs(process.argv.slice(2));

var options = {
    runner: true,
    scheduler: true,
    domain: argv.domain || argv.d,
    httpPort: argv['http-port'] || argv.p || 9005
};

if (argv.scheduler || argv.s) {
    options.runner = false;
} else if (argv.runner || argv.r) {
    options.scheduler = false;
}

taskGraphRunner.start(options)
     .then(function () {
        logger.info('Task Graph Runner Started.');
        if (options.scheduler && options.httpPort) {
             // swaggerRouter configuration
             var swaggerOptions = {
                 swaggerUi: '/swagger.json',
                 controllers: './api/rest',
                 useStubs: process.env.NODE_ENV === 'development' ? true : false // Conditionally turn on stubs (mock mode)
             };
             // The Swagger document (require it, build it programmatically, fetch it from a URL, ...)
             var swaggerDoc = require('./api/swagger.json');

             // Initialize the Swagger middleware
             swaggerTools.initializeMiddleware(swaggerDoc, function (middleware) {
                 // Interpret Swagger resources and attach metadata to request - must be first in swagger-tools middleware chain
                 app.use(middleware.swaggerMetadata());

                 // Validate Swagger requests
                 app.use(middleware.swaggerValidator());

                 // Route validated requests to appropriate controller
                 app.use(middleware.swaggerRouter(swaggerOptions));

                 // Serve the Swagger documents and Swagger UI
                 app.use(middleware.swaggerUi());

                 // Start the server
                 var config = {
                     hostname: '0.0.0.0',
                     httpPort: options.httpPort
                 };
                 server = http.createServer(app)
                 server.listen(config.httpPort, config.hostname, function () {
                     console.log('Your server is listening on port %d ', config.httpPort);
                     console.log('Swagger-ui is available on http://%s:%d/docs', config.hostname, config.httpPort);
                 });
             });
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
            if (server) server.close();
            process.nextTick(function () {
                process.exit(1);
            });
        });
});

module.exports = {
    injector: injector,
    taskGraphRunner: taskGraphRunner
};
