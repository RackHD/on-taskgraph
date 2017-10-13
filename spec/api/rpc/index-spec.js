// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved
/* jshint node:true */


'use strict';

// Since sinon.stub() has no returnsArg method, add a Promise wrapper.
// This will allow a stub to return a promise resolving to one of its call
// arguments.

function _buildMock(methods) {
    return _.reduce(methods, function(obj, method) {
        obj[method] = sinon.stub();
        return obj;
    }, {});
}

describe('TaskGraph.TaskScheduler.Server', function () {
    var mockery;

    before('setup mockery', function () {
        this.timeout(10000);

        // setup injector with mock override injecatbles
        var workflowsGraphMethods = [
            'workflowsGetGraphs',
            'workflowsGetGraphsByName',
            'workflowsPutGraphs',
            'workflowsDeleteGraphs'
        ];
        var tasksMethods = [
            'getBootstrap',
            'getTaskById',
            'postTaskById'
        ];
        var workflowsMethods = [
            'workflowsGet',
            'workflowsPost',
            'workflowsGetByInstanceId',
            'workflowsAction'
        ];
        var templateMethods = [
            'templatesLibGet'
        ];
        var workflowsTasksMethods = [
            'workflowsPutTask',
            'workflowsGetAllTasks',
            'workflowsGetTasksByName',
            'workflowDeleteTaskByName'
        ];

        var profilesMethods = [
            'profilesGetLibByName',
            'profilesGetMetadata',
            'profilesGetMetadataByName',
            'profilesPostSwitchError',
            'profilesPutLibByName'
        ];

        var gprcMethods = [
            'Server',
            'addProtoService',
            'load',
            'bind',
            'start',
            'stop'
        ];

        // setup mockery such that index.injector is our test injector.
        mockery = require('mockery');
        mockery.registerMock('./workflowGraphs.js', _buildMock(workflowsGraphMethods));
        mockery.registerMock('./workflowTasks.js', _buildMock(workflowsTasksMethods));
        mockery.registerMock('./tasks.js', _buildMock(tasksMethods));
        mockery.registerMock('./workflows.js', _buildMock(workflowsMethods));
        mockery.registerMock('./templates.js', _buildMock(templateMethods));
        mockery.registerMock('./profiles.js', _buildMock(profilesMethods));
        mockery.registerMock('grpc', _buildMock(gprcMethods));
        mockery.enable({ useCleanCache: true, warnOnUnregistered: false });

        helper.setupInjector([require('../../../api/rpc/index')]);
    });


    after('disable mockery', function () {
        mockery.deregisterAll();
        mockery.disable();
    });

    describe('gRPC', function () {
        var schedServer;
        var grpc;
        var addProtoServiceSpy;

        beforeEach(function() {
            var SchedServer =  helper.injector.get('TaskGraph.TaskScheduler.Server');
            schedServer = new SchedServer();
            grpc = require('grpc');
            addProtoServiceSpy = sinon.spy(sinon.stub());
            grpc.load.returns({scheduler: { Scheduler: { service: 'foo' } }});
            grpc.Server.returns({ addProtoService: addProtoServiceSpy,
                bind: sinon.stub(),
                start: sinon.stub(),
                forceShutdown: sinon.stub() });
            grpc.ServerCredentials = { createInsecure: sinon.stub() };
        });

        it('should start server successfully', function() {
            this.timeout(10000);
            return schedServer.start().should.eventually.equal(undefined);
        });

        it('should not start server if gRPC invalid', function() {
            this.timeout(10000);
            grpc.Server.returns({});
            return schedServer.start().should.be.rejected;
        });

        it('should stop server successfully', function() {
            return schedServer.start().then(function() {
                return schedServer.stop().should.eventually.equal(undefined);
            });
        });

        it('should not stop server if gRPC invalid', function() {
            return schedServer.start().then(function() {
                delete schedServer.gRPC.forceShutdown;
                return schedServer.stop().should.be.rejected;
            });
        });

        it('should call wrapper callback with response', function() {
            return schedServer.start().then(function() {
                var graphs = require('./workflowGraphs.js');
                var wrappedStub = addProtoServiceSpy.args[0][1].workflowsGetGraphs;
                var callback = sinon.stub();
                graphs.workflowsGetGraphs.resolves({foo: 'bar'});
                return wrappedStub({ }, callback).then(function() {
                    expect(callback).to.have.been.calledWith(null,
                        { response: JSON.stringify({foo: 'bar'}) });
                });
            });
        });

        it('should call wrapper callback with no response', function() {
            return schedServer.start().then(function() {
                var graphs = require('./workflowGraphs.js');
                var wrappedStub = addProtoServiceSpy.args[0][1].workflowsGetGraphs;
                var callback = sinon.stub();
                graphs.workflowsGetGraphs.resolves(undefined);
                return wrappedStub({ }, callback).then(function() {
                    expect(callback).not.to.be.called;
                });
            });
        });

        it('should call wrapper callback with error', function() {
            return schedServer.start().then(function() {
                var graphs = require('./workflowGraphs.js');
                var wrappedStub = addProtoServiceSpy.args[0][1].workflowsGetGraphs;
                var callback = sinon.stub();
                graphs.workflowsGetGraphs.rejects('error');
                return wrappedStub({ }, callback).then(function() {
                    expect(callback).to.have.been.calledWith(new Error('error'));
                });
            });
        });
    });
});
