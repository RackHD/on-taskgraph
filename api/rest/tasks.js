// Copyright 2016, EMC, Inc.

'use strict';

var injector = require('../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var tasksApiService = injector.get('Http.Services.Api.Tasks');
var _ = injector.get('_'); // jshint ignore:line
var Errors = injector.get('Errors');
var presenter = injector.get('common-api-presenter');

var getBootstrap = controller( function (req, res) {
    var scope = res.locals.scope;
    var ipAddress = res.locals.ipAddress;
    var macAddress = req.swagger.params.macAddress.value;
    return tasksApiService.getBootstrap(scope, ipAddress, macAddress);
});

var getTasksById = controller( {send204OnEmpty:true}, function (req){
    return tasksApiService.getTasks(req.swagger.params.identifier.value)
    .catch(function (err) {
        if (err.name === 'NoActiveTaskError') {
            //Return with no data, this will cause a 204 to be sent
            return;
        }
        // throw a NotFoundError
        throw new Errors.NotFoundError('Not Found');
    });
});

var postTaskById = controller( {success: 201}, function (req){
    var config = _.defaults(req.swagger.query || {}, req.body || {});
    return tasksApiService.postTasksById(req.swagger.params.identifier.value, config);
});

module.exports = {
    getBootstrap: getBootstrap,
    getTasksById: getTasksById,
    postTaskById: postTaskById
};
