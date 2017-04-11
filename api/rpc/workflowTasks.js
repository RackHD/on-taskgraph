// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved

'use strict';

var injector = require('../../index.js').injector;
var workflowApiService = injector.get('Http.Services.Api.Workflows');
var _ = injector.get('_');    // jshint ignore:line
var Promise = injector.get('Promise');

var workflowsPutTask = function(call) {
    return Promise.try(function() {
        return workflowApiService.defineTask(JSON.parse(call.request.body));
    });
};

var workflowsGetAllTasks = function() {
    return workflowApiService.getTaskDefinitions();
};

var workflowsGetTasksByName = function(call) {
    return Promise.try(function() {
        return workflowApiService.getWorkflowsTasksByName(call.request.injectableName);
    });
};

var workflowsDeleteTasksByName = function(call) {
    return workflowApiService.deleteWorkflowsTasksByName(call.request.injectableName);
};

module.exports = {
    workflowsPutTask: workflowsPutTask,
    workflowsGetAllTasks: workflowsGetAllTasks,
    workflowsGetTasksByName: workflowsGetTasksByName,
    workflowsDeleteTasksByName: workflowsDeleteTasksByName
};
