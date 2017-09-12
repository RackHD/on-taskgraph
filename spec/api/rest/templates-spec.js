// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved
/* jshint node:true */

'use strict';

describe('Http.Api.Templates', function () {
    var mockery;
    var templatesApi;
    var templates;
    var templatesApiService;

    before('setup mockery', function () {
        this.timeout(10000);

        // setup injector with mock override injecatbles
        var injectables = [
            helper.di.simpleWrapper({
                controller: function(opts, cb) {
                    if (typeof(opts) === 'function') {
                        cb = opts;
                    }
                    return cb;
                }
            }, 'Http.Services.Swagger'),
            helper.di.simpleWrapper({
                templatesGetByName: sinon.stub(),
                templatesLibGet: sinon.stub(),
                templatesLibPut: sinon.stub(),
                templatesMetaGet: sinon.stub(),
                templatesMetaGetByName: sinon.stub()
            }, 'Http.Services.Api.Templates')
        ];
        helper.setupInjector(injectables);

        // setup mockery such that index.injector is our test injector.
        mockery = require('mockery');
        mockery.registerMock('../../index.js', { injector: helper.injector });
        mockery.enable({ useCleanCache: true, warnOnUnregistered: false });

        // Now require file to test
        templatesApi = require('../../../api/rest/templates');

        templates = helper.injector.get('Templates');
        templatesApiService = helper.injector.get('Http.Services.Api.Templates');
    });

    beforeEach('before each', function () {
        this.sandbox = sinon.sandbox.create();
        this.sandbox.stub(templates, 'getAll').resolves();
    });

    afterEach('after each', function () {
        this.sandbox.restore();
    });

    after('disable mockery', function () {
        mockery.deregisterAll();
        mockery.disable();
    });


    describe("Test GET, PUT, DEL /templates:name", function() {
        var req = {
            swagger: {
                query: {
                    nodeId: '57a86b5c36ec578876878294',
                    randomData: 'random data'
                }
            }
        };
        var req1 = {
            swagger: {
                params: {
                    name: {
                        value:"arista-boot-config"
                    },
                    scope: {
                        value: "global"
                    },
                    randomData: 'random data'
                }
            }
        };
        var res = {
            locals: {
                ipAddress: "0.0.0.0"
            }
        };
        var template = "Template Content";
        var templateLib ="SWI=flash:/<%=bootfile%>";
        it("should get template", function() {
            var templatesApiService = helper.injector.get('Http.Services.Api.Templates');
            templatesApiService.templatesGetByName.resolves(template);
            return templatesApi.templatesGetByName(req, res)
                .should.eventually.equal(template);
        });

        it("should GET a Lib template", function() {
            var templatesApiService = helper.injector.get('Http.Services.Api.Templates');
            templatesApiService.templatesLibGet.resolves(templateLib);
            return templatesApi.templatesLibGet(req1, res)
                .should.eventually.equal(templateLib);
        });

        it("should PUT a Lib template", function() {
            var returnedPutValue ={
                "createdAt": "2017-09-14T18:18:38.489Z",
                "hash": "w9F3Ve/dOcnhcJBgkGUDZg==",
                "name": "ansible-external-inventory.js",
                "path": "/home/rackhd/git/2rackhd/rackhd/on-taskgraph/data/templates/ansible-external-inventory.js",
                "scope": "global",
                "updatedAt": "2017-09-18T13:19:10.990Z",
                "id": "2d138ac3-0e70-4dee-ae30-b242658bd2a4"
            } ;
            var templatesApiService = helper.injector.get('Http.Services.Api.Templates');
            templatesApiService.templatesLibPut.resolves(returnedPutValue);
            return templatesApi.templatesLibPut(req1, res)
                .should.eventually.equal(returnedPutValue);
        });

        it("should DELETE a Lib template", function() {
            var returnedDelValue = {
                "createdAt": "2017-09-14T18:18:38.489Z",
                "hash": "w9F3Ve/dOcnhcJBgkGUDZg==",
                "name": "ansible-external-inventory.js",
                "path": "/home/rackhd/git/2rackhd/rackhd/on-taskgraph/data/templates/ansible-external-inventory.js",
                "scope": "global",
                "updatedAt": "2017-09-18T13:19:10.990Z",
                "id": "2d138ac3-0e70-4dee-ae30-b242658bd2a4"
            };
            //var templatesApiService = helper.injector.get('Http.Services.Api.Templates');
            this.sandbox.stub(templates, 'unlink').resolves(returnedDelValue);
            return templatesApi.templatesLibDelete(req1, res)
                .should.eventually.equal(returnedDelValue);
        });

        it("should GET template metadata", function() {
            var metadata =[{
                    "id": "e33202fc-f77c-40cc-8bab-037115c1de9a",
                    "hash": "2Hmi/YDYFG9CezRfd4xVOA==",
                    "name": "renasar-ansible.pub",
                    "scope": "global"
                }];
            templatesApiService.templatesMetaGet.resolves(metadata);
            return templatesApi.templatesMetaGet(req1, res)
                .should.eventually.equal(metadata);
        });

        it("should GET template metadata by name", function() {
            var metadata =[{
                "id": "e33202fc-f77c-40cc-8bab-037115c1de9a",
                "hash": "2Hmi/YDYFG9CezRfd4xVOA==",
                "name": "renasar-ansible.pub",
                "scope": "global"
            }];
            templatesApiService.templatesMetaGetByName.resolves(metadata);
            return templatesApi.templatesMetaGetByName(req1, res)
                .should.eventually.equal(metadata);
        });
        
        
    });
});
