// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved
'use strict';

var injector = require('../../index.js').injector;
var templatesApiService = injector.get('Http.Services.Api.Templates');
var Promise = injector.get('Promise');

var templatesLibGet = function (call) {
    return Promise.try(function() {
        return templatesApiService.templatesLibGet(call.request.name, call.request.scope);
    });
};

var templatesLibPut  = function (call) {
    return Promise.try(function() {
        return templatesApiService.templatesLibPut(call.request.name,call.request,
            call.request.scope);
    });
};

var templatesMetaGet  = function () {
    return Promise.try(function() {
        return templatesApiService.templatesMetaGet();
    });
};

var templatesMetaGetByName  = function (call) {
    return Promise.try(function() {
        return templatesApiService.templatesMetaGetByName(call.request.name, call.request.scope);
    });
};

module.exports = {
    templatesLibGet:templatesLibGet,
    templatesLibPut:templatesLibPut,
    templatesMetaGet: templatesMetaGet,
    templatesMetaGetByName: templatesMetaGetByName
};
