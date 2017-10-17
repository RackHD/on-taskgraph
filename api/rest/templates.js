// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved
'use strict';

var injector = require('../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var templatesApiService = injector.get('Http.Services.Api.Templates');
var templates = injector.get('Templates');


var templatesGetByName  = controller( function (req, res) {
    return templatesApiService.templatesGetByName(req, res);
});

var templatesLibGet  = controller( function (req) {
    return templatesApiService.templatesLibGet(req.swagger.params.name.value, req.swagger.params.scope.value);
});

var templatesLibPut  = controller( {success: 201}, function (req) {
    return templatesApiService.templatesLibPut(req.swagger.params.name.value,
        req,
        req.swagger.params.scope.value);
});

var templatesLibDelete = controller(function(req) {
    return templates.unlink(req.swagger.params.name.value,
        req.swagger.params.scope.value);
});

var templatesMetaGet = controller(function() {
    return templatesApiService.templatesMetaGet();
});

var templatesMetaGetByName = controller(function(req) {
    return templatesApiService.templatesMetaGetByName(req.swagger.params.name.value, req.swagger.params.scope.value);
});

module.exports = {
    templatesGetByName:templatesGetByName,
    templatesLibGet:templatesLibGet,
    templatesLibPut: templatesLibPut,
    templatesLibDelete: templatesLibDelete,
    templatesMetaGet: templatesMetaGet,
    templatesMetaGetByName: templatesMetaGetByName
};
