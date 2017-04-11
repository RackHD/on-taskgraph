// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved
/* jshint node:true */

'use strict';

describe('Taskgraph.Api.Tasks.Rpc', function () {
    var mockery;
    var tasksApi;

    before('setup mockery', function () {
        this.timeout(10000);

        // setup injector with mock override injectables
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
                getTasksById: sinon.stub(),
                postTasksById: sinon.stub(),
                activeTaskExists: sinon.stub()

            }, 'Http.Services.Api.Tasks')
        ];
        helper.setupInjector(injectables);

        // setup mockery such that index.injector is our test injector.
        mockery = require('mockery');
        mockery.registerMock('../../index.js', { injector: helper.injector });
        mockery.enable();

        // Now require file to test
        tasksApi = require('../../../api/rpc/tasks');
    });


    after('disable mockery', function () {
        mockery.deregisterMock('../../index.js');
        mockery.disable();
    });

    describe('GET /tasks/:id', function () {
        it("should get a task by id", function() {
            var tasksApiService = helper.injector.get('Http.Services.Api.Tasks');
            tasksApiService.activeTaskExists.resolves('true');
            tasksApiService.getTasksById.resolves('a task');
            return tasksApi.getTasksById({ request: { identifier: '123' } })
                .should.eventually.equal('a task');
        });

        it("should reject with not found if getTasks rejects", function() {
            var tasksApiService = helper.injector.get('Http.Services.Api.Tasks');

            tasksApiService.getTasksById.rejects('Not Found');
            return tasksApi.getTasksById({ request: { identifier: '123' } })
                .should.be.rejectedWith('Not Found');
        });

        it("should reject with not found if req is invalid", function() {
            var tasksApiService = helper.injector.get('Http.Services.Api.Tasks');
            tasksApiService.getTasksById.resolves();
            return tasksApi.getTasksById(undefined)
                .should.be.rejectedWith('Not Found');
        });
    });

    describe("GET /tasks/bootstrap.js", function() {
        it("should get bootstrap", function() {
            var tasksApiService = helper.injector.get('Http.Services.Api.Tasks');
            tasksApiService.getBootstrap.resolves('bootstrap');
            return tasksApi.getBootstrap( { request: { scope: '' } },
                { request: { ipAddress: '123' } }, { request: { macAddress: '10.20.30' } } )
                .should.eventually.equal('bootstrap');
        });

        it("should reject if getBootstrap rejects", function() {
            var tasksApiService = helper.injector.get('Http.Services.Api.Tasks');
            tasksApiService.getBootstrap.rejects('No Bootstrap');
            return tasksApi.getBootstrap( { request: { scope: '' } },
                { request: { ipAddress: '123' } }, { request: { macAddress: '10.20.30' } } )
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
            return tasksApi.postTaskById({ request: { identifier: '123',
                config: '{ "foo": "bar" }' } })
                .then(function(body) {
                    expect(body).to.deep.equal({ foo: 'bar' });
                });
        });

        it("should reject if postTaskById rejects", function() {
            var tasksApiService = helper.injector.get('Http.Services.Api.Tasks');
            tasksApiService.postTasksById.rejects('post error');
            return tasksApi.postTaskById({ request: { identifier: '123' ,
                config: '{ "foo": "bar" }' } })
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
