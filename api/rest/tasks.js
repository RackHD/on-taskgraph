// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved
'use strict';

var injector = require('../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var tasksApiService = injector.get('Http.Services.Api.Tasks');
var _ = injector.get('_'); // jshint ignore:line
var Errors = injector.get('Errors');
var Promise = injector.get('Promise');

var getBootstrap = controller( function (req, res) {
    return Promise.try(function() {
        return tasksApiService.getBootstrap(req, res, req.swagger.params.macAddress.value);
    });
});

var getTasksById = controller( function (req){
    return Promise.try(function() {
        return tasksApiService.getTasks(req.swagger.params.identifier.value);
    })
    .catch(function () {
        throw new Errors.NotFoundError('Not Found');
    });
});

var postTaskById = controller( {success: 201}, function (req){
    return Promise.try(function() {
        var config = _.defaults(req.swagger.query || {}, req.body || {});
        return tasksApiService.postTasksById(req.swagger.params.identifier.value, config);
    });
});

module.exports = {
    getBootstrap: getBootstrap,
    getTasksById: getTasksById,
    postTaskById: postTaskById
};
