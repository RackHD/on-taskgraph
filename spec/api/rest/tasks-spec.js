// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved
/* jshint node:true */

'use strict';

describe('Http.Api.Tasks', function () {
    var mockery;
    var tasksApi;

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
                getBootstrap: sinon.stub(),
                getTasks: sinon.stub(),
                postTasksById: sinon.stub()
            }, 'Http.Services.Api.Tasks')
        ];
        helper.setupInjector(injectables);

        // setup mockery such that index.injector is our test injector.
        mockery = require('mockery');
        mockery.registerMock('../../index.js', { injector: helper.injector });
        mockery.enable({ useCleanCache: true, warnOnUnregistered: false });

        // Now require file to test
        tasksApi = require('../../../api/rest/tasks');
    });


    after('disable mockery', function () {
        mockery.deregisterAll();
        mockery.disable();
    });

    describe('GET /tasks/:id', function () {
        it("should get a task by id", function() {
            var tasksApiService = helper.injector.get('Http.Services.Api.Tasks');
            tasksApiService.getTasks.resolves('a task');
            return tasksApi.getTasksById({ swagger: { params: { identifier: { value: '123' } } } })
                .should.eventually.equal('a task');
        });

        it("should reject with not found if getTasks rejects", function() {
            var tasksApiService = helper.injector.get('Http.Services.Api.Tasks');

            tasksApiService.getTasks.rejects('Not Found');
            return tasksApi.getTasksById({ swagger: { params: { identifier: { value: '123' } } } })
                .should.be.rejectedWith('Not Found');
        });

        it("should reject with not found if req is invalid", function() {
            var tasksApiService = helper.injector.get('Http.Services.Api.Tasks');
            tasksApiService.getTasks.resolves();
            return tasksApi.getTasksById(undefined)
                .should.be.rejectedWith('Not Found');
        });
    });

    describe("GET /tasks/bootstrap.js", function() {
        it("should get bootstrap", function() {
            var tasksApiService = helper.injector.get('Http.Services.Api.Tasks');
            tasksApiService.getBootstrap.resolves('bootstrap');
            return tasksApi.getBootstrap({ swagger: { params: { macAddress: { value: '123' } } } })
                .should.eventually.equal('bootstrap');
        });
        
        it("should reject if getBootstrap rejects", function() {
            var tasksApiService = helper.injector.get('Http.Services.Api.Tasks');
            tasksApiService.getBootstrap.rejects('No Bootstrap');
            return tasksApi.getBootstrap({ swagger: { params: { macAddress: { value: '123' } } } })
                .should.be.rejectedWith('No Bootstrap');
        });

        it("should reject if req is invalid", function() {
            var tasksApiService = helper.injector.get('Http.Services.Api.Tasks');
            tasksApiService.getBootstrap.resolves();
            return tasksApi.getBootstrap(undefined)
                .should.be.rejectedWith(/undefined/);
        });
    });

    // Since sinon.stub() has no returnsArg method, add a Promise wrapper.
    // This will allow a stub to return a promise resolving to one of its call
    // arguments.
    function _stubPromiseWrapper(stub) {
        return function() {
            return Promise.resolve(stub.apply(sinon, arguments));
        };
    }

    describe("POST /tasks/:id", function() {
        beforeEach(function() {
            var tasksApiService = helper.injector.get('Http.Services.Api.Tasks');
            tasksApiService.postTasksById = sinon.stub();
        });

        it("should post a task", function() {
            var tasksApiService = helper.injector.get('Http.Services.Api.Tasks');
            tasksApiService.postTasksById = _stubPromiseWrapper(sinon.stub().returnsArg(1));
            return tasksApi.postTaskById({ swagger: { params: { identifier: { value: '123' } } }, 
                                           body: { foo: 'bar' } })
                .then(function(body) {
                    expect(body).to.deep.equal({ foo: 'bar' });
                });
        });

        
        it("should reject if postTaskById rejects", function() {
            var tasksApiService = helper.injector.get('Http.Services.Api.Tasks');
            tasksApiService.postTasksById.rejects('post error');
            return tasksApi.postTaskById({ swagger: { params: { identifier: { value: '123' } } }, 
                                           body: { foo: 'bar' } })
                .should.be.rejectedWith('post error');
            
        });

        
        it("should reject if postTaskById rejects", function() {
            var tasksApiService = helper.injector.get('Http.Services.Api.Tasks');
            tasksApiService.postTasksById.resolves();
            return tasksApi.postTaskById({ swagger: undefined, 
                                           body: { foo: 'bar' } })
                .should.be.rejectedWith(/undefined/);
            
        });
    });
});
