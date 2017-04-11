// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved
'use strict';

var injector = require('../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var workflowApiService = injector.get('Http.Services.Api.Workflows');
var Promise = injector.get('Promise');
var _ = injector.get('_');    // jshint ignore:line


/**
* @api {put} /api/2.0/workflows/tasks PUT /workflows/tasks
* @apiVersion 2.0.0
* @apiDescription Add tasks to task library
* @apiName workflowTasks-define
* @apiGroup workflowTasks
* @apiParam {json} task The task to be added to the library
* @apiSuccess {string} Task createdN
*/

var workflowsPutTask = controller({success: 201}, function(req) {
    return Promise.try(function() {
        return workflowApiService.defineTask(req.body);
    });
});

/**
* @api {get} /api/2.0/workflows/tasks GET /workflows/tasks
* @apiVersion 2.0.0
* @apiDescription Get list of tasks possible to run in workflows
* @apiName workflowTasks-getAll
* @apiSuccess {json} List of all tasks possible to run in workflows.
* @apiGroup workflowTasks
*/

var workflowsGetAllTasks = controller(function() {
    return workflowApiService.getTaskDefinitions();
});

/**
* @api {get} /api/2.0/workflows/tasks/:injectableName GET /workflows/tasks/:injectableName
* @apiVersion 2.0.0
* @apiDescription Get the task with the specified injectable name
* @apiName workflowTasks-getByName
* @apiParam {String} Task injectable name
* @apiSuccess {json} Task with the specified injectable name
* @apiGroup workflowTasks
*/

var workflowsGetTasksByName = controller(function(req) {
    return Promise.try(function() {
        return workflowApiService.getWorkflowsTasksByName(req.swagger.params.injectableName.value);
    });
});

/**
* @api {delete} /api/2.0/workflows/tasks/:injectableName DELETE /workflows/tasks/:injectableName
* @apiVersion 2.0.0
* @apiDescription Delete the task with the specified injectable name
* @apiName workflowTasks-deleteByName
* @apiGroup workflowTasks
* @apiParam {string} injectableName
* @apiSuccess {string} Task deleted
*/

var workflowsDeleteTasksByName = controller({success: 204}, function(req) {
    return workflowApiService.deleteWorkflowsTasksByName(req.swagger.params.injectableName.value);
});


module.exports = {
    workflowsPutTask: workflowsPutTask,
    workflowsGetAllTasks: workflowsGetAllTasks,
    workflowsGetTasksByName: workflowsGetTasksByName,
    workflowsDeleteTasksByName: workflowsDeleteTasksByName
};
