// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Workflows.2.0', function () {
    var mockery;
    var workflowsApi;

    before('start HTTP server', function () {
        this.timeout(10000);

        // setup injector with mock override injecatbles
        var injectables = [
            helper.di.simpleWrapper({
                controller: function(opts, cb) {
                        if (typeof(opts) === 'function') {
                            cb = opts;
                        }
                        return cb;
                },
                addLinksHeader: function(req,res,collection,query) {
                        return "data";
                }
            }, 'Http.Services.Swagger'),
            helper.di.simpleWrapper({
                getAllWorkflows: sinon.stub(),
                createAndRunGraph: sinon.stub(),
                getWorkflowByInstanceId: sinon.stub(),
                cancelTaskGraph: sinon.stub(),
                deleteTaskGraph: sinon.stub()
            }, 'Http.Services.Api.Workflows')
        ];

        helper.setupInjector(injectables);

        // setup mockery such that index.injector is our test injector.
        mockery = require('mockery');
        mockery.registerMock('../../index.js', { injector: helper.injector });
        mockery.enable( {useCleanCache: true, warnOnUnregistered: false} );

        // Now require file to test
        workflowsApi = require('../../../api/rest/workflows');
    });


    after('disable mockery', function () {
        mockery.deregisterAll();
        mockery.disable();
    });

    describe('GET /workflows', function () {
        it('should return a list of persisted graph objects', function () {
            var options = {query:{$top: undefined, $skip: undefined}};
            var workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
            workflowApiService.getAllWorkflows.resolves('a workflows');
            return workflowsApi.workflowsGet({ swagger: options})
                .should.eventually.equal('a workflows');

        });

        it('should return an error if not found ', function () {
            var options = {query:{$top: undefined, $skip: undefined}};
            var workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
            workflowApiService.getAllWorkflows.rejects('an error');
            return workflowsApi.workflowsGet({ swagger: options})
                .should.be.rejectedWith('an error');

        });

        it('should return a list of persisted graph objects, when query is sent', function () {
            var options =  {query:{$top: 1, $skip: 1, active:true}};
            var workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
            workflowApiService.getAllWorkflows.resolves('a workflows');
            return workflowsApi.workflowsGet({ swagger: options, query: 'test'})
                .should.eventually.equal('a workflows');

        });
    });

    describe('POST /workflows', function () {

        it('should persist a task graph', function () {

            var workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
            workflowApiService.createAndRunGraph.resolves('a posted workflows');
            return workflowsApi.workflowsPost({ swagger: { params:
                { identifier: { value: '123' } } }, body: { foo: 'bar' } })
                .should.eventually.equal('a posted workflows');
        });

        it("should reject if workflowsPost rejects", function() {
            var workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
            workflowApiService.createAndRunGraph.rejects('post error');
            return workflowsApi.workflowsPost({ swagger: { params:
                { identifier: { value: '123' } } }, body: { foo: 'bar' } })
                .should.be.rejectedWith('post error');
        });
    });

    describe('GET /workflows/:identifier', function () {
        it('should return a single persisted graph', function () {

            var workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
            workflowApiService.getWorkflowByInstanceId.resolves("an instance of a graph");

            return workflowsApi.workflowsGetByInstanceId({ swagger: { params:
                { identifier: { value: '123' } } } })
                .should.eventually.equal('an instance of a graph');
        });

        it('should return an error if not found', function () {

            var workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
            workflowApiService.getWorkflowByInstanceId.rejects('post error');
            return workflowsApi.workflowsGetByInstanceId({ swagger: { params:
                { identifier: { value: '123' } } } })
                .should.be.rejectedWith('post error');
        });
    });

    describe('workflowsAction', function () {
        it('should cancel a task, with proper command', function () {
            var workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
            workflowApiService.cancelTaskGraph.resolves('cancelled workflow');
            return workflowsApi.workflowsAction({ swagger: { params:
                { identifier: { value: '123' } } }, body: { command: 'cancel' } })
                .should.eventually.equal('cancelled workflow');
        });
    });

   describe('workflowsDeleteById', function () {
        it('should delete the Task with DELETE /workflows/id', function () {
            var workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
            workflowApiService.deleteTaskGraph.resolves("deleted workflow instance");

            return workflowsApi.workflowsDeleteByInstanceId({ swagger: { params:
                { identifier: { value: '123' } } } })
                .should.eventually.equal('deleted workflow instance');
        });
    });
});
