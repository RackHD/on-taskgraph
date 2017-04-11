// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved
'use strict';

var injector = require('../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var workflowApiService = injector.get('Http.Services.Api.Workflows');
var _ = injector.get('_');    // jshint ignore:line
var Promise = injector.get('Promise');

/**
* @api {get} /api/2.0/workflows/graphs GET /workflows/graphs
* @apiVersion 2.0.0
* @apiName workflowsGetGraphs
* @apiDescription Get list of all graphs
* @apiSuccess {json} List of graphs
* @apiGroup workflowGraphs
*/
var workflowsGetGraphs = controller(function() {
    return workflowApiService.getGraphDefinitions();
});

/**
* @api {get} /api/2.0/workflows/graphs/{injectableName} GET /workflows/graphs/{injectableName}
* @apiVersion 2.0.0
* @apiName workflowsGetGraphsByName
* @apiDescription Get the graph with the specified injectable name
* @apiParam {String} injectableName
* @apiSuccess Graph with the specified injectable name
* @apiGroup workflowGraphs
*/
var workflowsGetGraphsByName = controller(function(req) {
    return Promise.try(function() {
        return workflowApiService.getGraphDefinitions(req.swagger.params.injectableName.value);
    });
});

/**
* @api {put} /api/2.0/workflows/graphs PUT /workflows/graphs
* @apiVersion 2.0.0
* @apiName workflowsPutGraphs
* @apiDescription Add a graph to the graph library
* @apiParam {Object} body
* @apiSuccess Graph Created
* @apiGroup workflowGraphs
*/
// Can include name in body to modify a specific graph
var workflowsPutGraphs = controller({success: 201},function(req) {
    return Promise.try(function() {
        return workflowApiService.defineTaskGraph(req.body);
    });
});

/**
* @api {delete} /api/2.0/workflows/graphs DELETE /workflows/graphs/{injectableName}
* @apiVersion 2.0.0
* @apiName workflowsDeleteGraphsByName
* @apiDescription Delete the graph with the specified injectable name
* @apiParam {String} injectableName
* @apiSuccess Graph deleted
* @apiGroup workflowGraphs
*/
var workflowsDeleteGraphsByName = controller({success: 204}, function(req) {
    return workflowApiService.destroyGraphDefinition(req.swagger.params.injectableName.value); 
});

module.exports = {
    workflowsGetGraphs: workflowsGetGraphs,
    workflowsGetGraphsByName: workflowsGetGraphsByName,
    workflowsPutGraphs: workflowsPutGraphs,
    workflowsDeleteGraphsByName: workflowsDeleteGraphsByName
};
