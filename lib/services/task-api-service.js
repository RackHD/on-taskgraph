// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved

'use strict';

var di = require('di');
var ejs = require('ejs');

module.exports = taskApiServiceFactory;
di.annotate(taskApiServiceFactory, new di.Provide('Http.Services.Api.Tasks'));
di.annotate(taskApiServiceFactory,
    new di.Inject(
        'Protocol.Task',
        'Services.Waterline',
        'Errors',
        'Util',
        'Services.Configuration',
        'Services.Lookup',
        'Services.Environment',
        'Promise',
        'Templates'
    )
);
function taskApiServiceFactory(
    taskProtocol,
    waterline,
    Errors,
    util,
    configuration,
    lookupService,
    Env,
    Promise,
    templates
) {

    function NoActiveTaskError(message) {
        NoActiveTaskError.super_.call(this, message);
        Error.captureStackTrace(this, NoActiveTaskError);
    }

    util.inherits(NoActiveTaskError, Errors.BaseError);

    function TaskApiService() {
        this.NoActiveTaskError = NoActiveTaskError;
    }

    TaskApiService.prototype.getNode = function (macAddress) {
        macAddress = macAddress || '';
        macAddress = macAddress.toLowerCase();
        return waterline.nodes.findByIdentifier(macAddress);
    };

    TaskApiService.prototype.getTasksById = function (identifier) {
        return Promise.try(function () {
            if ( !identifier ) {
                throw new Errors.BadRequestError('Task id missing or undefined');
            }
            return taskProtocol.requestCommands(identifier);
        });
    };

    TaskApiService.prototype.activeTaskExists = function (identifier) {
        return Promise.try(function() {
            if ( !identifier ) {
                throw new Errors.BadRequestError('Task id missing or undefined');
            }
            return taskProtocol.activeTaskExists(identifier);
        });
    };

    TaskApiService.prototype.postTasksById = function (id, body) {
        return taskProtocol.respondCommands(id, body);
    };

    TaskApiService.prototype.getBootstrap = function (scope, ipAddress, macAddress) {
        return this.getNode(macAddress).then(function (node) {
            if (node) {

                var promises = [
                    Promise.props({
                        identifier: node.id,
                        server: configuration.get('apiServerAddress', '10.1.1.1'),
                        port: configuration.get('apiServerPort', 80),
                        ipaddress: ipAddress,
                        netmask: configuration.get('dhcpSubnetMask', '255.255.255.0'),
                        gateway: configuration.get('dhcpGateway', '10.1.1.1'),
                        macaddress: lookupService.ipAddressToMacAddress(ipAddress),
                        sku: Env.get('config', {}, [scope[0]]),
                        env: Env.get('config', {}, scope)
                    }),
                    templates.get('bootstrap.js', scope)
                ];

                return Promise.all(promises).spread(function (options, template) {
                    return ejs.render(template.contents, options);
                });
            } else {
                throw new Errors.NotFoundError('Node not found');
            }
        });
    };

    return new TaskApiService();
}
