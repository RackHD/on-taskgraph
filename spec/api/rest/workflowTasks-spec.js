// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved
/* jshint node:true */

'use strict';

describe('Http.Api.WorkflowTasks.2.0', function () {
    var mockery;
    var workflowTasksApi;

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
                addLinksHeader: function() {
                        return "data";
                }
            }, 'Http.Services.Swagger'),
            helper.di.simpleWrapper({
                defineTask: sinon.stub(),
                getTaskDefinitions: sinon.stub(),
                getWorkflowsTasksByName: sinon.stub(),
                deleteWorkflowsTasksByName: sinon.stub()
            }, 'Http.Services.Api.Workflows')
        ];

        helper.setupInjector(injectables);

        // setup mockery such that index.injector is our test injector.
        mockery = require('mockery');
        mockery.registerMock('../../index.js', { injector: helper.injector });
        mockery.enable({ useCleanCache: true, warnOnUnregistered: false});

        // Now require file to test
        workflowTasksApi = require('../../../api/rest/workflowTasks');
    });


    after('disable mockery', function () {
        mockery.deregisterAll();
        mockery.disable();
    });


    describe('PUT /workflows/tasks', function () {

        it('should put a workflow task', function () {

            var workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
            workflowApiService.defineTask.resolves('a task');
            return workflowTasksApi.workflowsPutTask({ body: { foo: 'bar' } })
                .should.eventually.equal('a task');
        });

        it("should reject if req is invalid", function() {
            var workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
            workflowApiService.defineTask.rejects('put error');
            return workflowTasksApi.workflowsPutTask(undefined)
                .should.be.rejectedWith(/undefined/);
        });

        it("should reject if defineTask rejects", function() {
            var workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
            workflowApiService.defineTask.rejects('put error');
            return workflowTasksApi.workflowsPutTask({ body: { foo: 'bar' } })
                .should.be.rejectedWith('put error');
        });
    });

    describe('GET /workflows/tasks', function () {
        it('should return a list of persisted graph objects', function () {

            var workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
            workflowApiService.getTaskDefinitions.resolves(['task1', 'task2']);
            return workflowTasksApi.workflowsGetAllTasks()
            .should.eventually.deep.equal(['task1', 'task2']);
        });

        it('should return an error if not found ', function () {
            var workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
            workflowApiService.getTaskDefinitions.rejects('an error');
            return workflowTasksApi.workflowsGetAllTasks().should.be.rejectedWith('an error');
        });
    });

    describe(' GET /workflows/tasks/:injectableName ', function () {
        it('should return a single persisted graph', function () {

            var workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
            workflowApiService.getWorkflowsTasksByName.resolves("an instance of a graph");
            return workflowTasksApi.workflowsGetTasksByName({ swagger: { params:
                {injectableName : { value: '123' } } } })
                .should.eventually.equal('an instance of a graph');
        });

        it('should return an error if not found', function () {

            var workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
            workflowApiService.getWorkflowsTasksByName.rejects('post error');
            return workflowTasksApi.workflowsGetTasksByName({ swagger: { params:
                {injectableName : { value: '123' } } } })
                .should.be.rejectedWith('post error');
        });

        it('should reject if req is undefined', function () {

            var workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
            workflowApiService.getWorkflowsTasksByName.resolves();
            return workflowTasksApi.workflowsGetTasksByName(undefined)
                .should.be.rejectedWith(/undefined/);
        });
    });

   describe('DELETE /workflows/tasks/:injectableName', function () {
        it('should delete the Task with DELETE /workflows/id', function () {
            var workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
            workflowApiService.deleteWorkflowsTasksByName.resolves('deleted');

            return workflowTasksApi.workflowsDeleteTasksByName({ swagger: { params:
                { injectableName: { value: '123' } } } })
                .should.eventually.equal('deleted');
        });
    });
});
