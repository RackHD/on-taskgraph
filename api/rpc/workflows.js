// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved

'use strict';

var injector = require('../../index.js').injector;
var workflowApiService = injector.get('Http.Services.Api.Workflows');
var _ = injector.get('_');    // jshint ignore:line

var workflowsGet = function (call) {
    return workflowApiService.getAllWorkflows(JSON.parse(call.request.query));
};

var workflowsPost = function (call) {
    var nodeId = call.request.nodeId;
    var configuration = JSON.parse(call.request.configuration);
    if (nodeId !== undefined) {
        return workflowApiService.createAndRunGraph(configuration, nodeId);
    } else {
        return workflowApiService.createAndRunGraph(configuration);
    }
};

var workflowsGetByInstanceId = function (call) {
    return workflowApiService.getWorkflowByInstanceId(call.request.identifier);
};

var workflowsAction = function (call) {
    var command = call.request.command;

    var actionFunctions = {
        cancel: function () {
            return workflowApiService.cancelTaskGraph(call.request.identifier);
        }
    };
    return actionFunctions[command]();
};

var workflowsDeleteByInstanceId = function (call) {
    return workflowApiService.deleteTaskGraph(call.request.identifier);
};

module.exports = {
    workflowsGet: workflowsGet,
    workflowsPost: workflowsPost,
    workflowsGetByInstanceId: workflowsGetByInstanceId,
    workflowsDeleteByInstanceId: workflowsDeleteByInstanceId,
    workflowsAction: workflowsAction
};
