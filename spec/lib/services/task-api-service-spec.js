// Copyright © 2016-2017 Dell Inc. or its subsidiaries.  All Rights Reserved.

'use strict';

describe('Taskgraph.Services.Api.Tasks', function () {
    var di = require('di');
    var core = require('on-core')(di, __dirname);
    var Errors;
    var taskApiService;
    var graph;
    var graphDefinition;
    var task;
    var taskDefinition;
    var waterline;
    var env;
    var workflowDefinition;
    var Promise;
    var taskProtocol;
    var util;
    var configuration;
    var templates;
    var lookupService;

    function mockConsul() {
        return {
            agent: {
                service: {
                    list: sinon.stub().resolves({}),
                    register: sinon.stub().resolves({}),
                    deregister: sinon.stub().resolves({})
                }
            }
        };
    }

    before('Taskgraph.Services.Api.Tasks before', function () {
        helper.setupInjector([
            helper.requireGlob('/lib/*.js'),
            helper.requireGlob('/lib/services/*.js'),
            helper.require('/api/rpc/index.js'),
            helper.di.simpleWrapper(mockConsul, 'consul'),
            require('on-tasks').injectables,
            core.workflowInjectables
        ]);
        Errors = helper.injector.get('Errors');
        taskApiService = helper.injector.get('Http.Services.Api.Tasks');
        waterline = helper.injector.get('Services.Waterline');
        env = helper.injector.get('Services.Environment');
        Promise = helper.injector.get('Promise');

        lookupService = helper.injector.get('Services.Lookup');
        taskProtocol = helper.injector.get('Protocol.Task');
        util = helper.injector.get('Util');
        configuration = helper.injector.get('Services.Configuration');
        templates = helper.injector.get('Templates');



        helper.setupTestConfig()
            .set(
                'apiServerAddress', '10.1.1.1'
            ).set(
                'apiServerPort', '80'
            ).set(
                'dhcpSubnetMask', '255.255.255.0'
            ).set(
                'dhcpGateway', '10.1.1.1'
            );
    });

    beforeEach(function () {
        waterline.nodes = {
            findByIdentifier: sinon.stub().resolves({id: 'testnodeid'})
        };
        waterline.lookups = {
            findOneByTerm: sinon.stub().resolves()
        };
        graph = {instanceId: 'testgraphid'};
        task = {instanceId: 'testtaskid'};
        graphDefinition = {injectableName: 'Graph.Test'};
        taskDefinition = {injectableName: 'Task.Test'};
        workflowDefinition = {
            injectableName: 'Task.Test',
            instanceId: 'testId',
            id: 'testid',
            _status: 'cancelled',
            active: sinon.spy()
        };

        this.sandbox = sinon.sandbox.create();

        this.sandbox.stub(taskProtocol, 'activeTaskExists');
        this.sandbox.stub(taskProtocol, 'respondCommands');
        this.sandbox.stub(taskProtocol, 'requestCommands');
        this.sandbox.stub(lookupService, 'ipAddressToMacAddress');
        this.sandbox.stub(templates, 'get');
        this.sandbox.stub(env, 'get');
    });

    afterEach('Taskgraph.Services.Api.Tasks afterEach', function () {
        this.sandbox.restore();
    });

    after(function () {
    });

    it('should get node by macAddress', function () {
        waterline.nodes.findByIdentifier.resolves({id: 'testnodeid'});

        return taskApiService.getNode('testMacAddress')
            .then(function(node) {
                expect(node).to.deep.equal({id: 'testnodeid'});
            });
    });

    it('should get tasks by id', function () {
        taskProtocol.activeTaskExists.resolves(task);
        taskProtocol.requestCommands.resolves(task);

        return taskApiService.getTasksById('testtaskid')
            .then(function(task) {
                expect(task).to.deep.equal({instanceId: 'testtaskid'});
            });
    });

    it('should throw error for undefined taskId', function(){
       return taskApiService.getTasksById(undefined)
           .should.be.rejectedWith(/undefined/);

    });

    it('should post task by id', function() {

        var body = {
            "label": "task-1",
            "taskName": "Task.Test"
        };

       taskProtocol.respondCommands.resolves(task, body);

       return taskApiService.postTasksById('testtaskid', body)
           .then(function(){
               expect(taskProtocol.respondCommands).to.have.been.calledOnce;
               expect(taskProtocol.respondCommands).to.have.been.calledWith('testtaskid', body);
           });
    });

    it('should get bootstrap', function() {
        waterline.nodes.findByIdentifier.resolves({id: 'testnodeid'});
        templates.get.resolves({ contents: "testContents" } );
        lookupService.ipAddressToMacAddress.resolves('1.2.3.4');

        return taskApiService.getBootstrap(['test'], '1.2.3.4', 'testMacAddress')
            .then(function() {
                expect(templates.get).to.have.been.calledOnce;
                expect(templates.get).to.have.been.calledWith('bootstrap.js', ['test']);
                expect(env.get).to.have.been.calledTwice;
            });
    });
});
