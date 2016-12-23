// Copyright 2016, EMC, Inc.

'use strict';

describe('Http.Services.Api.Workflows', function () {
    var di = require('di');
    var core = require('on-core')(di, __dirname);
    var Errors;
    var workflowApiService;
    var graph;
    var graphDefinition;
    var task;
    var taskDefinition;
    var store;
    var waterline;
    var env;
    var workflowDefinition;
    var workflow;
    var Promise;
    var TaskGraph;
    var TaskGraphRunner;

    function mockConsul() {
        return {
            agent: {
                service: {
                    list: sinon.stub().resolves({}),
                    register: sinon.stub().resolves({}),
                    deregister: sinon.stub().resolves({})
                }
            }
        }
    }

    before('Http.Services.Api.Workflows before', function() {
        helper.setupInjector([
            helper.requireGlob('/lib/*.js'),
            helper.requireGlob('/lib/services/*.js'),
            helper.require('/api/rpc/index.js'),
            helper.di.simpleWrapper(mockConsul, 'consul'),
            require('on-tasks').injectables,
            core.workflowInjectables
        ]);
        Errors = helper.injector.get('Errors');
        workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
        waterline = helper.injector.get('Services.Waterline');
        store = helper.injector.get('TaskGraph.Store');
        env = helper.injector.get('Services.Environment');
        Promise = helper.injector.get('Promise');
        TaskGraph = helper.injector.get('TaskGraph.TaskGraph');
        TaskGraphRunner = helper.injector.get('TaskGraph.Runner');
    });

    beforeEach(function() {
        waterline.nodes = {
            needByIdentifier: sinon.stub().resolves({ id: 'testnodeid' })
        };
        waterline.lookups = {
           findOneByTerm: sinon.stub().resolves()
        };
        waterline.graphobjects = {
            needOne: sinon.stub().resolves({ id: 'testgraphid', _status: 'pending' }),
            find: sinon.stub().resolves(),
            findOne: sinon.stub().resolves()
        };
        waterline.graphdefinitions = {
            destroy: sinon.stub().resolves({ injectableName: 'test' })
        };
        waterline.taskdefinitions = {
            destroy: sinon.stub().resolves({ injectableName: 'test' })
        };
        graph = { instanceId: 'testgraphid' };
        task = { instanceId: 'testtaskid' };
        workflow = { id: 'testid', _status: 'cancelled' };
        graphDefinition = { injectableName: 'Graph.Test' };
        taskDefinition = { injectableName: 'Task.Test' };
        workflowDefinition = { injectableName: 'Task.Test',
                               instanceId: 'testId',
                               id: 'testid',
                               _status: 'cancelled',
                               active: sinon.spy()
                              };
        TaskGraphRunner.taskScheduler = {
            evaluateGraphStream: {
                onNext: sinon.stub()
            }
        };

        this.sandbox = sinon.sandbox.create();
        this.sandbox.stub(store, 'findActiveGraphForTarget');
        this.sandbox.stub(store, 'getGraphDefinitions');
        this.sandbox.stub(store, 'persistGraphDefinition');
        this.sandbox.stub(store, 'deleteGraph');
        this.sandbox.stub(store, 'destroyGraphDefinition');
        this.sandbox.stub(store, 'persistTaskDefinition');
        this.sandbox.stub(store, 'getTaskDefinitions');
        this.sandbox.stub(store, 'deleteTaskByName');
        this.sandbox.stub(workflowApiService, 'findGraphDefinitionByName');
        this.sandbox.stub(workflowApiService, 'createActiveGraph');
        this.sandbox.stub(workflowApiService, 'runTaskGraph');
        this.sandbox.stub(env, 'get');
    });

    afterEach('Http.Services.Api.Profiles afterEach', function() {
        this.sandbox.restore();
    });

    after(function() {
        sinon.stub(workflowApiService, 'createAndRunGraph');
    });

    it('should create and run a graph not against a node', function () {
        workflowApiService.findGraphDefinitionByName.resolves(graphDefinition);
        workflowApiService.createActiveGraph.resolves(graph);
        TaskGraphRunner.taskScheduler.evaluateGraphStream.onNext.resolves();

        return workflowApiService.createAndRunGraph({
            name: 'Graph.Test',
            options: { test: 1 },
            context: { test: 2 },
            domain: 'test'
        })
        .then(function() {
            expect(workflowApiService.findGraphDefinitionByName).to.have.been.calledOnce;
            expect(workflowApiService.findGraphDefinitionByName)
                .to.have.been.calledWith('Graph.Test');
            expect(store.findActiveGraphForTarget).to.not.have.been.called;
            expect(workflowApiService.createActiveGraph).to.have.been.calledOnce;
            expect(workflowApiService.createActiveGraph).to.have.been.calledWith(
                graphDefinition, { test: 1 }, { test: 2 }, 'test'
            );
            //expect(TaskGraphRunner.taskScheduler.evaluateGraphStream.onNext).to.have.been.calledOnce;
            //expect(TaskGraphRunner.taskScheduler.evaluateGraphStream.onNext)
            //    .to.have.been.calledWith({ graphId: graph.instanceId });
        });
    });

    it('should create and run a graph against a node', function () {
        workflowApiService.findGraphDefinitionByName.resolves(graphDefinition);
        workflowApiService.createActiveGraph.resolves(graph);
        TaskGraphRunner.taskScheduler.evaluateGraphStream.onNext.resolves();
        store.findActiveGraphForTarget.resolves();

        return workflowApiService.createAndRunGraph({
            name: 'Graph.Test',
            options: { test: 1 },
            context: { test: 2 },
            domain: 'test'
        }, 'testnodeid')
        .then(function() {
            expect(workflowApiService.findGraphDefinitionByName).to.have.been.calledOnce;
            expect(workflowApiService.findGraphDefinitionByName)
                .to.have.been.calledWith('Graph.Test');
            expect(store.findActiveGraphForTarget).to.have.been.calledOnce;
            expect(store.findActiveGraphForTarget).to.have.been.calledWith('testnodeid');
            expect(workflowApiService.createActiveGraph).to.have.been.calledOnce;
            expect(workflowApiService.createActiveGraph).to.have.been.calledWith(
                graphDefinition, { test: 1 }, { target: 'testnodeid', test: 2 }, 'test'
            );
            //expect(TaskGraphRunner.taskScheduler.evaluateGraphStream.onNext).to.have.been.calledOnce;
            //expect(TaskGraphRunner.taskScheduler.evaluateGraphStream.onNext)
            //    .to.have.been.calledWith({ graphId: graph.instanceId });
            expect(env.get).to.not.be.called;
        });
    });

    it('should create and run a graph against a node with a proxy', function () {
        workflowApiService.findGraphDefinitionByName.resolves(graphDefinition);
        workflowApiService.createActiveGraph.resolves(graph);
        TaskGraphRunner.taskScheduler.evaluateGraphStream.onNext.resolves();
        store.findActiveGraphForTarget.resolves();
        waterline.lookups.findOneByTerm.resolves({id: 'testnodeid', proxy: 'proxy'});

        return workflowApiService.createAndRunGraph({
            name: 'Graph.Test',
            options: { test: 1 },
            context: { test: 2 },
            domain: 'test'
        }, 'testnodeid')
        .then(function() {
            expect(workflowApiService.findGraphDefinitionByName).to.have.been.calledOnce;
            expect(workflowApiService.findGraphDefinitionByName)
                .to.have.been.calledWith('Graph.Test');
            expect(store.findActiveGraphForTarget).to.have.been.calledOnce;
            expect(store.findActiveGraphForTarget).to.have.been.calledWith('testnodeid');
            expect(workflowApiService.createActiveGraph).to.have.been.calledOnce;
            expect(workflowApiService.createActiveGraph).to.have.been.calledWith(
                graphDefinition,
                { test: 1 },
                { target: 'testnodeid', test: 2, proxy: 'proxy' },
                'test'
            );
            //expect(TaskGraphRunner.taskScheduler.evaluateGraphStream.onNext).to.have.been.calledOnce;
            //expect(TaskGraphRunner.taskScheduler.evaluateGraphStream.onNext)
            //    .to.have.been.calledWith({ graphId: graph.instanceId });
            expect(env.get).to.not.be.called;
        });
    });

    it('should create and run a graph against a node with a sku', function () {
        workflowApiService.findGraphDefinitionByName.resolves(graphDefinition);
        workflowApiService.createActiveGraph.resolves(graph);
        TaskGraphRunner.taskScheduler.evaluateGraphStream.onNext.resolves();
        store.findActiveGraphForTarget.resolves();
        waterline.nodes.needByIdentifier.resolves({ id: 'testnodeid', sku: 'skuid' });
        env.get.withArgs('config.Graph.Test').resolves('Graph.Test');

        return workflowApiService.createAndRunGraph({
            name: 'Graph.Test',
            options: { test: 1 },
            context: { test: 2 },
            domain: 'test'
        }, 'testnodeid')
        .then(function() {
            expect(workflowApiService.findGraphDefinitionByName).to.have.been.calledOnce;
            expect(workflowApiService.findGraphDefinitionByName)
                .to.have.been.calledWith('Graph.Test');
            expect(store.findActiveGraphForTarget).to.have.been.calledOnce;
            expect(store.findActiveGraphForTarget).to.have.been.calledWith('testnodeid');
            expect(workflowApiService.createActiveGraph).to.have.been.calledOnce;
            expect(workflowApiService.createActiveGraph).to.have.been.calledWith(
                graphDefinition, { test: 1 }, { target: 'testnodeid', test: 2 }, 'test'
            );
            //expect(TaskGraphRunner.taskScheduler.evaluateGraphStream.onNext).to.have.been.calledOnce;
            //expect(TaskGraphRunner.taskScheduler.evaluateGraphStream.onNext)
            //    .to.have.been.calledWith({ graphId: graph.instanceId });
            expect(env.get).to.have.been.calledWith('config.Graph.Test', 'Graph.Test', 
                ['skuid', "global"]);
        });
    });

    it('should create and run a graph against a node with a sku', function () {
        workflowApiService.findGraphDefinitionByName.resolves(graphDefinition);
        workflowApiService.createActiveGraph.resolves(graph);
        TaskGraphRunner.taskScheduler.evaluateGraphStream.onNext.resolves();
        store.findActiveGraphForTarget.resolves();
        waterline.nodes.needByIdentifier.resolves({ id: 'testnodeid', sku: 'skuid' });
        env.get.withArgs('config.Graph.Test').resolves('Graph.Test.skuid');

        return workflowApiService.createAndRunGraph({
            name: 'Graph.Test',
            options: { test: 1 },
            context: { test: 2 },
            domain: 'test'
        }, 'testnodeid')
        .then(function() {
            expect(workflowApiService.findGraphDefinitionByName).to.have.been.calledOnce;
            expect(workflowApiService.findGraphDefinitionByName)
                .to.have.been.calledWith('Graph.Test.skuid');
            expect(store.findActiveGraphForTarget).to.have.been.calledOnce;
            expect(store.findActiveGraphForTarget).to.have.been.calledWith('testnodeid');
            expect(workflowApiService.createActiveGraph).to.have.been.calledOnce;
            expect(workflowApiService.createActiveGraph).to.have.been.calledWith(
                graphDefinition, { test: 1 }, { target: 'testnodeid', test: 2 }, 'test'
            );
            //expect(TaskGraphRunner.taskScheduler.evaluateGraphStream.onNext).to.have.been.calledOnce;
            //expect(TaskGraphRunner.taskScheduler.evaluateGraphStream.onNext)
            //    .to.have.been.calledWith({ graphId: graph.instanceId });
            expect(env.get).to.have.been.calledWith('config.Graph.Test', 'Graph.Test',
                ['skuid', "global"]);
        });
    });

    it('should not create a graph against a node if there is an existing one active', function () {
        workflowApiService.findGraphDefinitionByName.resolves(graphDefinition);
        store.findActiveGraphForTarget.resolves({});

        return expect(
            workflowApiService.createAndRunGraph({
                name: 'Graph.Test',
                options: { test: 1 },
                context: { test: 2 },
                domain: 'test'
            }, 'testnodeid')
        ).to.eventually.match(/Unable to run multiple task graphs against a single target/);
    });

    it('should throw error if the graph name is missing', function() {
        return expect(
            workflowApiService.createAndRunGraph({
                options: { test: 1 },
                context: { test: 2 },
                domain: 'test'
            }, 'testnodeid')
        ).to.be.eventually.have.property('message').that.includes(
            'Graph name is missing or in wrong format');
    });

    it('should throw error if the graph name is in wrong format', function() {
        return Promise.map([123, null, ''], function(name) {
            return expect(
                workflowApiService.createAndRunGraph({
                    name: name,
                    options: { test: 1 },
                    context: { test: 2 },
                    domain: 'test'
                }, 'testnodeid')
            ).to.eventually.have.property('message').that.includes(
                'Graph name is missing or in wrong format');
        });
    });

    it('should return a NotFoundError if the node was not found', function () {
        waterline.nodes.needByIdentifier.rejects(new Errors.NotFoundError('Not Found'));
        return expect(
            workflowApiService.createAndRunGraph({
                name: 'graph.not.exist',
                options: { test: 1 },
                context: { test: 2 },
                domain: 'test'
            }, 'testnodeid')
        ).to.eventually.have.property('message').that.includes('Not Found');
    });

    it('should return a BadRequestError on a graph creation/validation failure', function () {
        workflowApiService.createActiveGraph.restore();
        workflowApiService.findGraphDefinitionByName.resolves({
            tasks: [
                { label: 'duplicate' },
                { label: 'duplicate' }
            ]
        });

        return expect(
            workflowApiService.createAndRunGraph({
                name: 'Graph.Test',
                options: { test: 1 },
                context: { test: 2 },
                domain: 'test'
            }, 'testnodeid')
        ).to.eventually.have.property('message').that.includes(
                'The task label \'duplicate\' is used more than once');
    });

    it('should return a NotFoundError if the node was not found', function () {
        waterline.graphobjects.findOne.rejects(new Errors.NotFoundError('Not Found'));
        return expect(workflowApiService.findActiveGraphForTarget('testnodeid'))
            .to.be.rejectedWith(Errors.NotFoundError);
    });

    it('should persist a graph definition', function () {
        store.persistGraphDefinition.resolves({ injectableName: 'test' });
        this.sandbox.stub(TaskGraph, 'validateDefinition').resolves();
        return workflowApiService.defineTaskGraph(graphDefinition)
        .then(function() {
            expect(store.persistGraphDefinition).to.have.been.calledOnce;
            expect(store.persistGraphDefinition).to.have.been.calledWith(graphDefinition);
            expect(TaskGraph.validateDefinition).to.have.been.calledOnce;
        });
    });

    it('should validate a graph definition', function () {
        store.persistGraphDefinition.resolves();
        var badDefinition = {
            tasks: [
                { label: 'duplicate' },
                { label: 'duplicate' }
            ]
        };

        return expect(workflowApiService.defineTaskGraph(badDefinition))
            .to.be.rejectedWith(Errors.BadRequestError, /duplicate/);
    });

    it('should throw a NotFoundError if a graph definition does not exist', function() {
        workflowApiService.findGraphDefinitionByName.restore();
        store.getGraphDefinitions.resolves(null);
        return expect(workflowApiService.findGraphDefinitionByName('test'))
            .to.be.rejectedWith(Errors.NotFoundError);
    });

    it('should create and persist a graph', function() {
        var persistStub = sinon.stub().resolves(graph);
        workflowApiService.createActiveGraph.restore();
        this.sandbox.stub(workflowApiService, 'createGraph').resolves({ persist: persistStub });
        return workflowApiService.createActiveGraph(graphDefinition, null, null, null)
        .then(function(_graph) {
            expect(workflowApiService.createGraph).to.have.been.calledOnce;
            expect(workflowApiService.createGraph).to.have.been.calledWith(
                graphDefinition, null, null, null);
            expect(_graph).to.equal(graph);
            expect(persistStub).to.have.been.calledOnce;
        });
    });

    it('should get workflows tasks by name', function () {
        store.getTaskDefinitions.resolves({ injectableName: 'test' });
        return workflowApiService.getWorkflowsTasksByName(taskDefinition)
        .then(function() {
            expect(store.getTaskDefinitions).to.have.been.calledOnce;
            expect(store.getTaskDefinitions).to.have.been.calledWith(taskDefinition);
        });
    });


    it('should delete/destroy graph', function () {
        waterline.graphdefinitions.destroy.resolves(graph);
        store.destroyGraphDefinition.resolves({ injectableName: 'test' });
        return workflowApiService.destroyGraphDefinition(taskDefinition)
        .then(function() {
            expect(store.destroyGraphDefinition).to.have.been.calledOnce;
            expect(store.destroyGraphDefinition).to.have.been.calledWith(taskDefinition);
        });
    });


    it('should put workflows tasks by name', function () {
        store.getTaskDefinitions.resolves(task);
        return workflowApiService.putWorkflowsTasksByName(taskDefinition, task)
        .then(function() {
            expect(store.getTaskDefinitions).to.have.been.calledOnce;
            expect(store.getTaskDefinitions).to.have.been.calledWith(task);
            expect(store.persistTaskDefinition).to.have.been.calledOnce;
            expect(store.persistTaskDefinition).to.have.been.calledWith(taskDefinition);
        });
    });

    it('should throw error, when cancelling an non-active workflow ', function () {
        var mockWorkflowError = new Errors.TaskCancellationError(
            "testid is not an active workflow"
        );
        waterline.graphobjects.needOne.rejects(mockWorkflowError);
        return workflowApiService.cancelTaskGraph()
            .should.be.rejectedWith(mockWorkflowError);
    });


    it('should delete workflows tasks by name', function () {
        store.getTaskDefinitions.resolves(task);
        return workflowApiService.deleteWorkflowsTasksByName(task)
        .then(function() {
            expect(store.getTaskDefinitions).to.have.been.calledOnce;
            expect(store.getTaskDefinitions).to.have.been.calledWith(task);
            expect(store.deleteTaskByName).to.have.been.calledOnce;
            expect(store.deleteTaskByName).to.have.been.calledWith(task);
        });
    });

    it('should return workflow by instanceId ', function() {
        waterline.graphobjects.needOne.resolves(workflow);
        return workflowApiService.getWorkflowByInstanceId().then(function (workflows) {
            expect(workflows).to.deep.equal(workflow);
        });
    });

    it('should return Not Found Error when invalid instanceId is passed', function() {
        waterline.graphobjects.needOne.rejects(new Errors.NotFoundError('Not Found'));
        return expect(workflowApiService.getWorkflowByInstanceId())
               .to.be.rejectedWith(Errors.NotFoundError);
    });

    it('should return active workflows ', function() {
        var activeWorkflow = {
                               id      : 'testgraphid',
                               _status : 'pending'
                             };
        waterline.graphobjects.find.resolves(activeWorkflow);
        return expect(workflowApiService.getWorkflowByInstanceId()).to.become(activeWorkflow);
    });
});
