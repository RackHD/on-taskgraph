// Copyright 2017, EMC, Inc.

'use strict';

var di = require('di');


module.exports = templateApiServiceFactory;
di.annotate(templateApiServiceFactory, new di.Provide('Http.Services.Api.Templates'));
di.annotate(templateApiServiceFactory,
    new di.Inject(
        'Promise',
        'Http.Services.Api.Workflows',
        'Protocol.Task',
        'Protocol.Events',
        'Services.Waterline',
        'Services.Configuration',
        'Services.Lookup',
        'Errors',
        '_',
        'Templates',
        'Services.Environment',
        'Http.Services.Swagger',
        'Constants',
        'Http.Services.Api.Nodes'
    )
);
function templateApiServiceFactory(
    Promise,
    workflowApiService,
    taskProtocol,
    eventsProtocol,
    waterline,
    configuration,
    lookupService,
    Errors,
    _,
    templates,
    Env,
    swaggerService,
    Constants,
    nodeApiService
) {
    function TemplateApiService() {
    }

    TemplateApiService.prototype.templatesGetByName = function(req, res) {
        return Promise.resolve()
            .then(function() {
                var nodeId = req.query.nodeId;
                var macs = req.query.macs;
                if (!nodeId && !macs) {
                    throw new Errors.BadRequestError("Neither query nodeId nor macs is provided.");
                }

                if (nodeId) {
                    return nodeApiService.getNodeByIdentifier(nodeId);
                }

                if (macs) {
                    return nodeApiService.getNodeByIdentifier(macs);
                }
            })
            .then(function(node) {
                if (!node) {
                    throw new Errors.NotFoundError('no node found');
                }
                return Promise.all([
                    workflowApiService.findActiveGraphForTarget(node.id),
                    node
                ]);
            })
            .spread(function(workflow, node) {
                if (!workflow) {
                    throw new Errors.NotFoundError('no active workflow');
                }
                return Promise.all([
                    swaggerService.makeRenderableOptions(req, res, workflow.context),
                    taskProtocol.requestProperties(node.id)
                ]);
            })
            .spread(function(options, properties) {
                return templates.render(
                    req.swagger.params.name.value,
                    _.merge({}, options, properties),
                    res.locals.scope
                ) ;
            });
    };

    TemplateApiService.prototype.templatesLibGet = function(name, scope) {
         return templates.get(name, scope)
            .then(function(template) {
                if (!template || !template.contents) {
                    throw new Errors.NotFoundError('template not found');
                }
                return template.contents;   
            });

    };

    TemplateApiService.prototype.templatesLibPut = function(name, req, scope) {
        return templates.put(name,
            req,
            scope);
    };

    TemplateApiService.prototype.templatesMetaGet = function() {
        return templates.getAll();
    };

    TemplateApiService.prototype.templatesMetaGetByName = function(name, scope) {
       return templates.getName(name, scope);
    };

    return new TemplateApiService();
}
