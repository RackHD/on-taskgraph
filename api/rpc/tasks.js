// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../index.js').injector;
var tasksApiService = injector.get('Http.Services.Api.Tasks');
var _ = injector.get('_'); // jshint ignore:line
var Errors = injector.get('Errors');
var Promise = injector.get('Promise');

var getBootstrap = function(call) {
    return Promise.try(function() {
        var scope = call.request.scope;
        var ipAddress = call.request.ipAddress;
        var macAddress = call.request.macAddress;
        return tasksApiService.getBootstrap(scope, ipAddress, macAddress);
    });
};

var getTasksById = function(call) {
    return Promise.try(function() {
        return tasksApiService.activeTaskExists(call.request.identifier);
    })
    .catch(function (err) {
        if (err.name === 'NoActiveTaskError') {
            return {};
        }
        // throw a NotFoundError
        throw new Errors.NotFoundError('Not Found');
    }).then(function (activeTask) {
            if (activeTask !== {}) {
                return tasksApiService.getTasksById(call.request.identifier);
            }
            return {};
        });
};

var postTaskById = function(call) {
    return Promise.try(function() {
        return tasksApiService.postTasksById(call.request.identifier,
            JSON.parse(call.request.config));
    });
};

module.exports = {
    getBootstrap: getBootstrap,
    getTasksById: getTasksById,
    postTaskById: postTaskById
};
