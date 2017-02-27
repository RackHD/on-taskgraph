// Copyright 2016, EMC Inc.

'use strict';

var injector = require('../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var addLinks = injector.get('Http.Services.Swagger').addLinksHeader;
var workflowApiService = injector.get('Http.Services.Api.Workflows');
var Errors = injector.get('Errors');
var Constants = injector.get('Constants');
var _ = injector.get('_');    // jshint ignore:line
var sanitizer = injector.get('Sanitizer');

/**
* @api {get} /api/2.0/workflows GET /workflows
* @apiVersion 2.0.0
* @apiDescription Get list of active and past run workflow instances
* @apiName workflows-get
* @apiGroup workflows
* @apiSuccess {json} List of all workflows or if there are none an empty object.
*/

var workflowsGet = controller(function(req, res) {
    var query;
    var options = {
        skip: req.swagger.query.$skip,
        limit: req.swagger.query.$top
    };

    query = req.query;
    if (req.swagger.query.active !== undefined) {
        query = req.swagger.query.active ?
            _.merge({}, req.query, { _status: Constants.Task.ActiveStates }) :
            _.merge({}, req.query, { _status: { '!': Constants.Task.ActiveStates } });
    }

    return workflowApiService.getAllWorkflows(query, options)
    .tap(function(workflows) {
        return addLinks(req, res, 'graphobjects', query);
    });
});

/**
* @api {post} /api/2.0/workflows POST /workflows
* @apiVersion 2.0.0
* @apiDescription Run a new workflow
* @apiName workflows-run
* @apiGroup workflows
* @apiError Error problem was encountered, workflow was not run.
*/

var workflowsPost = controller({success: 201}, function(req) {
    var configuration = _.defaults(req.swagger.query || {}, req.body || {});
    return workflowApiService.createAndRunGraph(configuration);
});

/**
* @api {get} /api/2.0/workflows/:identifier GET /workflows/:identifier
* @apiVersion 2.0.0
* @apiDescription get a specific workflow
* @apiName workflows-getByInstanceId
* @apiGroup workflows
* @apiParam {String} instanceId of workflow
* @apiSuccess {json} workflows of the particular identifier or if there are none an empty object.
* @apiError NotFound There is no workflow with <code>instanceId</code>
*/

var workflowsGetByInstanceId = controller(function(req) {
    return workflowApiService.getWorkflowByInstanceId(req.swagger.params.identifier.value)
    .then(function(graph) {
        sanitizer.scrub(graph);
        return graph;
    });
});

/**
* @api {put} /api/2.0/workflows/:identifier PUT /workflows/:identifier/action
* @apiVersion 2.0.0
* @apiDescription perform the specified action on the selected workflow
* @apiName workflows-action
* @apiGroup workflows
* @apiParam {String} identifier of workflow
* @apiSuccess {json}  object.
* @apiError NotFound There is no workflow with <code>instanceId</code>
*/
var workflowsAction = controller({success: 202}, function(req) {
    var command = req.body.command;

    var actionFunctions = {
        cancel: function() {
            return workflowApiService.cancelTaskGraph(req.swagger.params.identifier.value);
        }
    };

    if (!_(actionFunctions).has(command)) {
        throw new Errors.BadRequestError(
            command + ' is not a valid workflow action'
        );
    }
    return actionFunctions[command]();
});

/**
* @api {delete} /api/2.0/workflows/:identifier DELETE /workflows/:identifier
* @apiVersion 2.0.0
* @apiDescription Cancel currently running workflows for specified node
* @apiName workflows-DeleteByInstanceId
* @apiGroup workflows
* @apiParam {String} instanceId of workflow
* @apiSuccess {json}  object.
* @apiError NotFound The node with the identifier was not found <code>instanceId</code>
*/

var workflowsDeleteByInstanceId = controller({success: 204}, function(req) {
    return workflowApiService.deleteTaskGraph(req.swagger.params.identifier.value);
});

module.exports = {
    workflowsGet: workflowsGet,
    workflowsPost: workflowsPost,
    workflowsGetByInstanceId: workflowsGetByInstanceId,
    workflowsDeleteByInstanceId: workflowsDeleteByInstanceId,
    workflowsAction: workflowsAction
};
