// Copyright 2014, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

describe('Task Graph Subscriptions', function () {
    before('Task Graph Subscriptions before', function() {
        helper.setupInjector(
            _.flatten([
                require('on-tasks').injectables,
                helper.require('/lib/task-graph-runner'),
                helper.require('/lib/registry'),
                helper.require('/lib/scheduler'),
                helper.require('/lib/stores/memory'),
                helper.require('/lib/stores/waterline'),
                helper.require('/lib/task-graph'),
                helper.require('/lib/task-graph-subscriptions')
            ])
        );
    });

    describe('service', function() {
        var registry;
        var tgrProtocol;
        var subscriber;
        var disposeStub;

        before('service before', function() {
            tgrProtocol = helper.injector.get('Protocol.TaskGraphRunner');
            registry = helper.injector.get('TaskGraph.Registry');
            disposeStub = sinon.stub();
            _.forEach(Object.getPrototypeOf(tgrProtocol), function(v, k) {
                tgrProtocol[k] = sinon.stub().resolves({
                    dispose: disposeStub
                });
            });
            sinon.stub(registry, 'fetchActiveGraphsSync');
        });

        beforeEach('service beforeEach', function() {
            subscriber = helper.injector.get('TaskGraph.Subscriptions');
            registry.fetchActiveGraphsSync.reset();
            registry.fetchActiveGraphsSync.returns();
            disposeStub.reset();
        });

        after('service after', function() {
            registry.fetchActiveGraphsSync.restore();
        });

        it('should start', function() {
            expect(subscriber.subscriptions).to.deep.equal([]);

            return subscriber.start()
            .then(function() {
                expect(subscriber.subscriptions).to.be.an.array;
                expect(subscriber.subscriptions).to.have.length(10);

                return subscriber.stop();
            });
        });

        it('should stop', function() {
            var stopStub = sinon.stub();

            registry.fetchActiveGraphsSync.returns([
                { stop: stopStub }, { stop: stopStub }, { stop: stopStub }
            ]);

            return subscriber.start()
            .then(function() {
                return subscriber.stop();
            })
            .then(function() {
                expect(stopStub).to.have.been.calledThrice;
                expect(disposeStub.callCount).to.equal(10);
                expect(subscriber.subscriptions).to.have.length(0);
            });
        });
    });

    describe('run task graph', function() {
        var registry;
        var tgSubscriptions;
        var graphStubObj;
        var createStub;
        var Errors;

        before('run task graph before', function() {
            Errors = helper.injector.get('Errors');
            registry = helper.injector.get('TaskGraph.Registry');
            tgSubscriptions = helper.injector.get('TaskGraph.Subscriptions');
            // Default mocks used by the majority of tests. Custom overrides
            // are in unit tests that need them.
            graphStubObj = { start: sinon.stub().resolves() };
            createStub = sinon.stub().returns(graphStubObj);
            sinon.stub(registry, 'fetchGraphSync');
            sinon.stub(registry, 'putActiveGraphSync');
            sinon.stub(registry, 'fetchGraphDefinitionCatalog');
            sinon.stub(registry, 'hasActiveGraphSync');
        });

        beforeEach('run task graph beforeEach', function() {
            registry.fetchGraphSync.reset();
            registry.fetchGraphSync.returns({ create: createStub });
            registry.putActiveGraphSync.reset();
            registry.fetchGraphDefinitionCatalog.reset();
            registry.fetchGraphDefinitionCatalog.resolves([
                { injectableName: 'Test.Graph', friendlyName: 'Test Graph Friendly Name' }
            ]);
            registry.hasActiveGraphSync.reset();
            registry.hasActiveGraphSync.returns();
            graphStubObj.start.reset();
            createStub.reset();
        });

        after('run task graph after', function() {
            registry.fetchGraphSync.restore();
            registry.putActiveGraphSync.restore();
            registry.fetchGraphDefinitionCatalog.restore();
            registry.hasActiveGraphSync.restore();
        });

        it('should reject if there is an existing graph against a specified target', function() {
            registry.hasActiveGraphSync.returns(true);
            return expect(tgSubscriptions.runTaskGraph('TestGraph', {}, 'target'))
                .to.be.rejectedWith(
                    Errors.BadRequestError,
                    /Unable to run multiple task graphs against a single target/);
        });

        it('should reject if the graph name does not exist', function() {
            registry.fetchGraphDefinitionCatalog.resolves([ ]);
            return expect(tgSubscriptions.runTaskGraph('TestGraph'))
                .to.be.rejectedWith(/Graph with name TestGraph does not exist/);
        });

        it('should start a task graph by injectableName', function() {
            return tgSubscriptions.runTaskGraph('Test.Graph')
            .then(function() {
                expect(registry.fetchGraphSync).to.have.been.calledWith('Test.Graph');
                expect(createStub).to.have.been.calledWith(undefined, {});
                expect(graphStubObj.start).to.have.been.calledOnce;
            });
        });

        it('should start a task graph by friendlyName', function() {
            return tgSubscriptions.runTaskGraph('Test Graph Friendly Name')
            .then(function() {
                expect(registry.fetchGraphSync).to.have.been.calledWith('Test Graph Friendly Name');
                expect(createStub).to.have.been.calledWith(undefined, {});
                expect(graphStubObj.start).to.have.been.calledOnce;
            });
        });

        it('should start a task graph with custom options', function() {
            var options = { op1: 'test', op2: 'test2' };
            return tgSubscriptions.runTaskGraph('Test.Graph', options)
            .then(function() {
                expect(registry.fetchGraphSync).to.have.been.calledWith('Test.Graph');
                expect(createStub).to.have.been.calledWith(options, {});
                expect(graphStubObj.start).to.have.been.calledOnce;
            });
        });

        it('should start a task graph against a target', function() {
            var options = { op1: 'test', op2: 'test2' };
            return tgSubscriptions.runTaskGraph('Test.Graph', options, 'testtarget')
            .then(function() {
                expect(registry.fetchGraphSync).to.have.been.calledWith('Test.Graph');
                expect(createStub).to.have.been.calledWith(options, { target: 'testtarget' });
                expect(registry.putActiveGraphSync)
                    .to.have.been.calledWith(graphStubObj,'testtarget');
                expect(graphStubObj.start).to.have.been.calledOnce;
            });
        });
    });

    describe('registry getters', function() {
        var registry;
        var tgSubscriptions;
        var graphStubObj;
        var taskCatalog;
        var graphCatalog;

        before('registry getters before', function() {
            registry = helper.injector.get('TaskGraph.Registry');
            tgSubscriptions = helper.injector.get('TaskGraph.Subscriptions');
            sinon.stub(registry, 'fetchTaskDefinitionCatalog');
            sinon.stub(registry, 'fetchGraphDefinitionCatalog');
            sinon.stub(registry, 'fetchActiveGraphSync');
            sinon.stub(registry, 'fetchActiveGraphsSync');
        });

        beforeEach('registry getters beforeEach', function() {
            taskCatalog = [{ name: 'task1' }, { name: 'task2' }];
            graphCatalog = [{ name: 'graph1' }, { name: 'graph2' }];
            registry.fetchTaskDefinitionCatalog.returns(taskCatalog);
            registry.fetchGraphDefinitionCatalog.returns(graphCatalog);
            registry.fetchActiveGraphSync.reset();
            registry.fetchActiveGraphsSync.reset();
            graphStubObj = {
                status: sinon.stub().returns('running')
            };
        });

        after('registry getters after', function() {
            registry.fetchTaskDefinitionCatalog.restore();
            registry.fetchGraphDefinitionCatalog.restore();
            registry.fetchActiveGraphSync.restore();
            registry.fetchActiveGraphsSync.restore();
        });

        it('should get the graph library', function() {
            var filter = { filter: 'filter' };
            var library = tgSubscriptions.getTaskGraphLibrary(filter);
            expect(registry.fetchGraphDefinitionCatalog).to.have.been.calledWith(filter);
            expect(library).to.equal(graphCatalog);
        });

        it('should get the task library', function() {
            var filter = { filter: 'filter' };
            var library = tgSubscriptions.getTaskLibrary(filter);
            expect(registry.fetchTaskDefinitionCatalog).to.have.been.calledWith(filter);
            expect(library).to.equal(taskCatalog);
        });

        it('should get an active task graph', function() {
            var filter = { filter: 'filter' };
            registry.fetchActiveGraphSync.returns(graphStubObj);
            expect(tgSubscriptions.getActiveTaskGraph(filter)).to.equal('running');
            expect(registry.fetchActiveGraphSync).to.have.been.calledWith(filter);
            expect(graphStubObj.status).to.have.been.calledOnce;
        });

        it('should return undefined when there is no active task graph for filter', function() {
            var filter = { filter: 'filter' };
            registry.fetchActiveGraphSync.returns(undefined);
            expect(tgSubscriptions.getActiveTaskGraph(filter)).to.be.undefined;
        });

        it('should get active task graphs', function() {
            var filter = { filter: 'filter' };
            var graphStubObjects = [graphStubObj, graphStubObj, graphStubObj];
            registry.fetchActiveGraphsSync.returns(graphStubObjects);
            var graphStatuses = tgSubscriptions.getActiveTaskGraphs(filter);
            expect(graphStatuses).to.deep.equal(['running', 'running', 'running']);
            expect(registry.fetchActiveGraphsSync).to.have.been.calledWith(filter);
            expect(graphStubObj.status).to.have.been.calledThrice;
        });
    });

    describe('task/graph definitions', function() {
        var registry;
        var tgSubscriptions;
        var TaskGraph;
        var Task;

        before(function() {
            registry = helper.injector.get('TaskGraph.Registry');
            tgSubscriptions = helper.injector.get('TaskGraph.Subscriptions');
            TaskGraph = helper.injector.get('TaskGraph.TaskGraph');
            Task = helper.injector.get('Task.Task');

            sinon.stub(TaskGraph, 'createRegistryObject');
            sinon.stub(Task, 'createRegistryObject');
            sinon.stub(registry, 'registerGraph');
            sinon.stub(registry, 'registerTask');
        });

        beforeEach('task/graph definitions after', function() {
            TaskGraph.createRegistryObject.reset();
            Task.createRegistryObject.reset();
            registry.registerGraph.reset();
            registry.registerTask.reset();
        });

        after('task/graph definitions after', function() {
            TaskGraph.createRegistryObject.restore();
            Task.createRegistryObject.restore();
            registry.registerGraph.restore();
            registry.registerTask.restore();
        });

        it('should reject if task definition is empty', function() {
            return expect(tgSubscriptions.defineTask(undefined))
                .to.be.rejectedWith(/object.*is required/);
        });

        it('should reject if task definition does not have an injectableName', function() {
            return expect(tgSubscriptions.defineTask({ friendlyName: 'Test' }))
                .to.be.rejectedWith(/string.*is required/);
        });

        it('should reject if graph definition is empty', function() {
            return expect(tgSubscriptions.defineTaskGraph(undefined))
                .to.be.rejectedWith(/object.*is required/);
        });

        it('should reject if graph definition does not have an injectableName', function() {
            return expect(tgSubscriptions.defineTaskGraph({ friendlyName: 'Test' }))
                .to.be.rejectedWith(/string.*is required/);
        });

        it('should define a graph', function() {
            TaskGraph.createRegistryObject.returns('graph object');
            var definition = {
                injectableName: 'Test.Graph.Definition'
            };
            return tgSubscriptions.defineTaskGraph(definition)
            .then(function(result) {
                expect(TaskGraph.createRegistryObject).to.have.been.calledWith(definition);
                expect(registry.registerGraph).to.have.been.calledWith('graph object');
                expect(result).to.equal(definition.injectableName);
            });
        });

        it('should define a task', function() {
            Task.createRegistryObject.returns('task object');
            var definition = {
                injectableName: 'Test.Task.Definition'
            };
            return tgSubscriptions.defineTask(definition)
            .then(function(result) {
                expect(Task.createRegistryObject).to.have.been.calledWith(definition);
                expect(registry.registerTask).to.have.been.calledWith('task object');
                expect(result).to.equal(definition.injectableName);
            });
        });
    });

    describe('pause task graph', function() {
        it('should pause a task graph');
    });

    describe('cancel task graph', function() {
        it('should cancel a task graph');
    });

    describe('resume task graph', function() {
        it('should resume a task graph');
    });
});
