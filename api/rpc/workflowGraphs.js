// Copyright 2016, EMC Inc.

'use strict';

var injector = require('../../index.js').injector;
var workflowApiService = injector.get('Http.Services.Api.Workflows');
var _ = injector.get('_');    // jshint ignore:line

var workflowsGetGraphs = function() {
    return workflowApiService.getGraphDefinitions();
};

var workflowsGetGraphsByName = function(call) {
    return workflowApiService.getGraphDefinitions(call.request.injectableName);
};

var workflowsPutGraphs = function(call) {
    return workflowApiService.defineTaskGraph(JSON.parse(call.request.body));
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
