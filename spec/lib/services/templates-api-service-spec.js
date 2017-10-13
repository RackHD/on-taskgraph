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
            helper.di.simpleWrapper({render: function(){},
                get: function(){},
                put: function(){},
                getName: function(){},
            getAll: function(){}}, 'Templates'),
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


        it('Should GET a template', function () {
            var template = {
                contents: "Template Content"
            };
            var name = "arista-config";
            var scope = "global";
            this.sandbox.stub(templates, 'get').resolves(template);
            return templatesApiService.templatesLibGet(name, scope)
                .then(function (data) {
                    expect(templates.get).to.have.been.calledWith(
                        name,
                        scope
                    );
                    expect(data).to.deep.equal(template.contents);
                });
        });


        it('Should PUT a template', function () {

            var req = {
                query: {macs: "ee"},
                swagger: {
                    params: {name: {value: 'any'}}
                }
            };
            var returnedPutValue ={
                "createdAt": "2017-09-14T18:18:38.489Z",
                "hash": "w9F3Ve/dOcnhcJBgkGUDZg==",
                "name": "ansible-external-inventory.js",
                "path": "/home/rackhd/git/2rackhd/rackhd/on-taskgraph/data/templates/ansible-external-inventory.js",
                "scope": "global",
                "updatedAt": "2017-09-18T13:19:10.990Z",
                "id": "2d138ac3-0e70-4dee-ae30-b242658bd2a4"
            };
            var name = "arista-config";
            var scope = "global";
            this.sandbox.stub(templates, 'put').resolves(returnedPutValue);
            return templatesApiService.templatesLibPut(name, req, scope)
                .then(function (data) {
                    expect(templates.put).to.have.been.calledOnce;
                    expect(data).to.deep.equal(returnedPutValue);
                });
        });

        it('Should GET templates metadata', function () {
            var metadata =[{
                "id": "e33202fc-f77c-40cc-8bab-037115c1de9a",
                "hash": "2Hmi/YDYFG9CezRfd4xVOA==",
                "name": "renasar-ansible.pub",
                "scope": "global"
            }, {
                "id": "e33202fc-f77c-40cc-8bab-037115c1de9a",
                "hash": "2Hmi/YDYFG9CezRfd4xVOA==",
                "name": "renasar-ansible.pub",
                "scope": "global"
            }];
            this.sandbox.stub(templates, 'getAll').resolves(metadata);
            return templatesApiService.templatesMetaGet()
                .then(function (data) {
                    expect(templates.getAll).to.have.been.calledOnce;
                    expect(data).to.deep.equal(metadata);
                });
        });

        it('Should GET a template metadata by name', function () {
            var metadata =[{
                "id": "e33202fc-f77c-40cc-8bab-037115c1de9a",
                "hash": "2Hmi/YDYFG9CezRfd4xVOA==",
                "name": "renasar-ansible.pub",
                "scope": "global"
            }];
            var req = {
                request: {
                    name: "templateName",
                    scope: "global"
                }
            };
            this.sandbox.stub(templates, 'getName').resolves(metadata);
            return templatesApiService.templatesMetaGetByName(req)
                .then(function (data) {
                    expect(templates.getName).to.have.been.calledOnce;
                    expect(data).to.deep.equal(metadata);
                });
        });


    });

});
