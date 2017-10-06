// Copyright 2015, EMC, Inc.
/* jshint node: true */

"use strict";
module.exports = Runner;
var di = require('di');
var onFinished = require('on-finished');
di.annotate(Runner, new di.Provide('rest'));
di.annotate(Runner, new di.Inject(
    'Services.Configuration',
    'Logger',
    'uuid',
    'Constants',
    'Protocol.Events',
    'Services.Lookup',
    'Errors',
    'Events'
    )
);
function Runner(configureFile, Logger, uuid, constants,
                eventsProtocol, lookupService, Errors, events) {
    var logger = Logger.initialize('TaskGraph');
    var server;
    function start() {
        var app = require('express')();
        var http = require('http');
        var swaggerTools = require('swagger-tools');
        var rewriter = require('express-urlrewrite');

        var swaggerOptions = {
            swaggerUi: '/swagger.json',
            controllers: './api/rest',
            // Conditionally turn on stubs (mock mode)
            useStubs: process.env.NODE_ENV === 'development' ? true : false

        };
        // The Swagger document (require it, build it programmatically,
        // fetch it from a URL, ...)
        var swaggerDoc = require('./api/swagger.json');

        // Initialize the Swagger middleware
        swaggerTools.initializeMiddleware(swaggerDoc, function (middleware) {
            //re-route common and current
            //var versionPath = configuration.get('versionBase', '2.0');
            app.use(require('body-parser').json({limit: '10mb'}));
            app.use(rewriter('/api/current/*', '/api/2.0/$1'));
            app.use(rewriter('/api/common/*', '/api/2.0/$1'));
            // Imaging Event Middleware

            // Interpret Swagger resources and attach metadata to request -
            // must be first in swagger-tools middleware chain
            app.use(middleware.swaggerMetadata());

            // Validate Swagger requests
            app.use(middleware.swaggerValidator());
            app.use(httpEventMiddleware);
            // Route validated requests to appropriate controller
            app.use(middleware.swaggerRouter(swaggerOptions));

            // Serve the Swagger documents and Swagger UI
            app.use(middleware.swaggerUi());

            // Start the server
            var config = {
                hostname: configureFile.get ('taskGraphEndpoint', {address: '0.0.0.0'})['address'],
                httpPort: configureFile.get('taskGraphEndpoint', {port: 9005})['port']
            };
            server = http.createServer(app);

            server.on('close', function() {
                logger.info('Server Closing.');
            });

            server.listen(config.httpPort, config.hostname, function () {
                logger.info('Your server is listening on port %d'.format(config.httpPort));
                logger.info('Swagger-ui is available on http://%s:%d/docs'
                    .format(config.hostname, config.httpPort));
            });
        });
    }

    function stop() {
        server.close();
    }

    function httpEventMiddleware(req, res, next) {
        req._startAt = process.hrtime();
        res.locals.ipAddress = remoteAddress(req);
        res.locals.scope = ['global'];
        res.locals.uuid = uuid.v4();

        onFinished(res, function () {
            if (!req._startAt) {
                return '';
            }

            var diff = process.hrtime(req._startAt),
                ms = diff[0] * 1e3 + diff[1] * 1e-6;

            var data = {
                ipAddress: res.locals.ipAddress
            };

            if (res.locals.identifier) {
                data.id = res.locals.identifier;
            }

            logger.debug(
                'http: ' + req.method +
                ' ' + res.statusCode +
                ' ' + ms.toFixed(3) +
                ' - ' + res.locals.uuid +
                ' - ' + req.originalUrl,
                data
            );
            if(res.statusCode > 299 ){
                if(configureFile.get("minLogLevel") > constants.Logging.Levels.debug){

                    logger.error(
                        'http: ' + req.method +
                        ' ' + res.statusCode +
                        ' ' + ms.toFixed(3) +
                        ' - ' + res.locals.uuid +
                        ' - ' + req.originalUrl,
                        data
                    );
                }
                logger.error('http: ' + JSON.stringify(res.body));
            }

            eventsProtocol.publishHttpResponse(
                res.locals.identifier || 'external',
                {
                    address: res.locals.ipAddress,
                    method: req.method,
                    url: req.originalUrl,
                    statusCode: res.statusCode,
                    time: ms.toFixed(3)
                }
            );
        });

        lookupService.ipAddressToNodeId(res.locals.ipAddress).then(function (nodeId) {
            res.locals.identifier = nodeId;
            return [ constants.Scope.Global ];
        }).then(function(scope) {
            res.locals.scope = scope;
        }).catch(Errors.NotFoundError, function () {
            // No longer log NotFoundErrors
        }).catch(function (error) {
            events.ignoreError(error);
        }).finally(function () {
            next();
        });
    }

    function remoteAddress(req) {

        if(req.get("X-Real-IP")) {
            return req.get("X-Real-IP");
        }

        if (req.ip) {
            return req.ip;
        }

        if (req._remoteAddress) {
            return req._remoteAddress;
        }

        if (req.connection) {
            return req.connection.remoteAddress;
        }

        return undefined;
    }

    return {
        start: start,
        stop: stop
    };
}
