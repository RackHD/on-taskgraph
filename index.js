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
            helper.requireGlob(__dirname + '/controllers/services/**/*.js'),
            helper.requireGlob(__dirname + '/controllers/view/**/*.js')
        ])
    ),
    taskGraphRunner = injector.get('TaskGraph.Runner'),
    logger = injector.get('Logger').initialize('TaskGraph');
var app = require('express')();
var http = require('http');
var swaggerTools = require('swagger-tools');
var options = {
    runner: true,
    scheduler: true
};
if (_.contains(process.argv, '-s') || _.contains(process.argv, '--scheduler')) {
    options.runner = false;
} else if (_.contains(process.argv, '-r') || _.contains(process.argv, '--runner')) {
    options.scheduler = false;
}
if (_.contains(process.argv, '-d') || _.contains(process.argv, '--domain')) {
    _.reduce(process.argv, function (lastArg, arg) {
        if (lastArg === '-d' || lastArg === '--domain') {
            if (_.contains(['-s', '--scheduler', '-r', '--runner'], arg)) {
                console.error('\nNo value for domain specified!');
                process.exit(1);
            }
            options.domain = arg;
        }
        return arg;
    });
}
if (_.last(process.argv) === '-d' || _.last(process.argv) === '--domain') {
    console.error('\nNo value for domain specified!');
    process.exit(1);
}

taskGraphRunner.start(options)
     .then(function () {
         logger.info('Task Graph Runner Started.');
         // swaggerRouter configuration
         var options = {
             swaggerUi: '/swagger.json',
             controllers: './controllers',
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
             app.use(middleware.swaggerRouter(options));

             // Serve the Swagger documents and Swagger UI
             app.use(middleware.swaggerUi());

             // Start the server
             var config = {
                 hostname: '0.0.0.0',
                 httpPort: 9005
             }
             http.createServer(app).listen(config.httpPort, config.hostname, function () {
                 console.log('Your server is listening on port %d ', config.httpPort);
                 console.log('Swagger-ui is available on http://%s:%d/docs', config.hostname, config.httpPort);
             });
         });
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
            process.nextTick(function () {
                process.exit(1);
            });
        });
});

module.exports = {
    injector: injector
};