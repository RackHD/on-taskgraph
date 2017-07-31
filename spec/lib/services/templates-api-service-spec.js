// Copyright 2015-2016, EMC, Inc.

'use strict';

describe('Http.Api.Templates', function () {
    var workflowApiService;
    var taskProtocol;
    var templatesApiService;
    var templates;
    var Errors;
    var waterline;
    var swagger;
    var findActiveGraphForTargetStub;
    var getNodeByIdentifierStub;
    var nodeApiService;

    beforeEach('Http.Api.Templates before', function(){
        helper.setupInjector([
            //onHttpContext.prerequisiteInjectables,
            helper.require("/lib/services/templates-api-service"),
            helper.di.simpleWrapper({getNodeByIdentifier: function(){}}, 'Http.Services.Api.Nodes'),
            helper.di.simpleWrapper({makeRenderableOptions: function(){}}, 'Http.Services.Swagger'),
            helper.di.simpleWrapper({findActiveGraphForTarget: function(){}},
                'Http.Services.Api.Workflows'),
            helper.di.simpleWrapper({render: function(){}}, 'Templates'),
        ]);
        this.sandbox = sinon.sandbox.create();
        waterline = helper.injector.get('Services.Waterline');
        Errors = helper.injector.get('Errors');

        taskProtocol = helper.injector.get('Protocol.Task');
        nodeApiService = helper.injector.get('Http.Services.Api.Nodes');
        swagger = helper.injector.get('Http.Services.Swagger');
        workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
        templates = helper.injector.get('Templates');
        templatesApiService = helper.injector.get('Http.Services.Api.Templates');
    });

    beforeEach('before each', function () {
        this.sandbox.stub(taskProtocol, 'requestProperties').resolves({});
        getNodeByIdentifierStub = this.sandbox.stub(nodeApiService, 'getNodeByIdentifier');
        this.sandbox.stub(swagger, 'makeRenderableOptions').resolves({});
        findActiveGraphForTargetStub = this.sandbox.stub(
            workflowApiService, 'findActiveGraphForTarget');
        this.sandbox.stub(templates, 'render').resolves();
    });

    afterEach('after each', function () {
        this.sandbox.restore();
    });

    var nodeId = "1234abcd5678effe9012dcba";
    var req = {
        query: {nodeId: nodeId},
        swagger: {
            params: {name: {value: 'any'}}
        }
    };
    var scope = "anything";
    var res = {locals: {scope: scope}};
    var graph = {
        instanceId: '0123',
        context: {}
    };

    describe('template api service', function () {
        it('should return a template with query nodeId', function () {
            findActiveGraphForTargetStub.resolves(graph);
            getNodeByIdentifierStub.resolves({id: nodeId});
            return templatesApiService.templatesGetByName(req, res)
                .then(function () {
                    expect(nodeApiService.getNodeByIdentifier).to.be.calledOnce;
                    expect(nodeApiService.getNodeByIdentifier).to.be.calledWith(nodeId);
                    expect(workflowApiService.findActiveGraphForTarget).to.be.calledOnce;
                    expect(workflowApiService.findActiveGraphForTarget).to.be.calledWith(nodeId);
                    expect(swagger.makeRenderableOptions).to.be.calledOnce;
                    expect(swagger.makeRenderableOptions).to.be.calledWith(req, res, {});
                    expect(taskProtocol.requestProperties).to.be.calledOnce;
                    expect(taskProtocol.requestProperties).to.be.calledWith(nodeId);
                    expect(templates.render).to.have.been.calledOnce;
                    expect(templates.render).to.have.been.calledWith(
                        'any',
                        {},
                        scope
                    );
                });
        });

        it('should throw no node found error', function (done) {
            var req = {
                query: {},
                swagger: {
                    params: {name: {value: 'any'}}
                }
            };

            getNodeByIdentifierStub.resolves();
            return templatesApiService.templatesGetByName(req, res)
                .then(function () {
                    throw new Error('Should throw errors');
                })
                .catch(function(err){
                    expect(nodeApiService.getNodeByIdentifier).to.have.not.been.called;
                    expect(workflowApiService.findActiveGraphForTarget).to.have.not.been.called;
                    expect(swagger.makeRenderableOptions).to.have.not.been.called;
                    expect(taskProtocol.requestProperties).to.have.not.been.called;
                    expect(templates.render).to.have.not.been.called;
                    expect(err).to.deep.equal(
                        new Errors.BadRequestError('Neither query nodeId nor macs is provided.')
                    );
                    done();
                });
        });

        it('should throw no node found error', function (done) {
            getNodeByIdentifierStub.resolves();
            return templatesApiService.templatesGetByName(req, res)
                .then(function () {
                    throw new Error('Should throw errors');
                })
                .catch(function(err){
                    expect(nodeApiService.getNodeByIdentifier).to.be.calledOnce;
                    expect(nodeApiService.getNodeByIdentifier).to.be.calledWith(nodeId);
                    expect(err).to.deep.equal(new Errors.NotFoundError('no node found'));
                    done();
                });
        });

        it('should throw no active workflow found error', function (done) {
            var mac = '00:50:56:aa:7d:85';
            var req = {
                query: {macs: mac},
                swagger: {
                    params: {name: {value: 'any'}}
                }
            };
            getNodeByIdentifierStub.resolves({id: nodeId});
            findActiveGraphForTargetStub.resolves();
            return templatesApiService.templatesGetByName(req, res)
                .then(function () {
                    throw new Error('Should throw errors');
                })
                .catch(function(err){
                    expect(nodeApiService.getNodeByIdentifier).to.be.calledOnce;
                    expect(nodeApiService.getNodeByIdentifier).to.be.calledWith(mac);
                    expect(workflowApiService.findActiveGraphForTarget).to.be.calledOnce;
                    expect(workflowApiService.findActiveGraphForTarget).to.be.calledWith(nodeId);
                    expect(err).to.deep.equal(new Errors.NotFoundError('no active workflow'));
                    done();
                });
        });

    });

});
