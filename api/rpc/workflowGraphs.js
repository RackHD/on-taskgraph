// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved

'use strict';

var injector = require('../../index.js').injector;
var workflowApiService = injector.get('Http.Services.Api.Workflows');
var _ = injector.get('_');    // jshint ignore:line
var Promise = injector.get('Promise');

var workflowsGetGraphs = function() {
    return workflowApiService.getGraphDefinitions();
};

var workflowsGetGraphsByName = function(call) {
    return Promise.try(function() {
        return workflowApiService.getGraphDefinitions(call.request.injectableName);
    });
};

var workflowsPutGraphs = function(call) {
    return Promise.try(function() {
        return workflowApiService.defineTaskGraph(JSON.parse(call.request.body));
    });
};

var workflowsDeleteGraphsByName = function(call) {
    return workflowApiService.destroyGraphDefinition(call.request.injectableName); 
};

module.exports = {
    workflowsGetGraphs: workflowsGetGraphs,
    workflowsGetGraphsByName: workflowsGetGraphsByName,
    workflowsPutGraphs: workflowsPutGraphs,
    workflowsDeleteGraphsByName: workflowsDeleteGraphsByName
};
