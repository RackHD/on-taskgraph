// Copyright 2014, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

require('../helper');

describe(require('path').basename(__filename), function () {
    var injector;
    var registry;

    beforeEach(function() {
        injector = helper.baseInjector.createChild(
            _.flatten([
                require('renasar-tasks').injectables,
                helper.require('/lib/task-graph-runner'),
                helper.require('/lib/registry'),
                helper.require('/lib/scheduler'),
                helper.require('/lib/stores/memory'),
                helper.require('/lib/stores/waterline'),
                helper.require('/lib/task-graph'),
                helper.require('/lib/task-graph-subscriptions')
            ])
        );
        registry = injector.get('TaskGraph.Registry');
    });

    it('should start', function() {
        var tgrProtocol = injector.get('Protocol.TaskGraphRunner');
        _.forEach(Object.getPrototypeOf(tgrProtocol), function(v, k) {
            tgrProtocol[k] = sinon.stub().resolves({});
        });

        var subscriber = injector.get('TaskGraph.Subscriptions');
        expect(subscriber.subscriptions).to.deep.equal([]);

        return subscriber.start()
        .then(function() {
            expect(subscriber.subscriptions).to.be.an.array;
            expect(subscriber.subscriptions).to.have.length(10);
        });
    });

    it('should stop', function() {
        var disposeStub = sinon.stub();
        var stopStub = sinon.stub();

        var tgrProtocol = injector.get('Protocol.TaskGraphRunner');
        _.forEach(Object.getPrototypeOf(tgrProtocol), function(v, k) {
            tgrProtocol[k] = sinon.stub().resolves({
                dispose: disposeStub
            });
        });

        registry.fetchActiveGraphsSync = sinon.stub().returns([
            { stop: stopStub }, { stop: stopStub }, { stop: stopStub }
        ]);
        var subscriber = injector.get('TaskGraph.Subscriptions');

        return subscriber.start()
        .then(function() {
            return subscriber.stop();
        })
        .then(function() {
            expect(stopStub).to.have.been.calledThrice;
            expect(disposeStub.callCount).to.equal(10);
        });
    });

    describe('run task graph', function() {
        var childInjector;
        var tgSubscriptions;
        var graphStubObj;
        var createStub;

        beforeEach(function() {
            childInjector = injector.createChild([
                helper.require('/lib/task-graph-subscriptions'),
                helper.require('/lib/registry')
            ]);
            registry = childInjector.get('TaskGraph.Registry');
            tgSubscriptions = childInjector.get('TaskGraph.Subscriptions');

            // Default mocks used by the majority of tests. Custom overrides
            // are in unit tests that need them.
            graphStubObj = { start: sinon.stub().resolves() };
            createStub = sinon.stub().returns(graphStubObj);
            registry.fetchGraphSync = sinon.stub().returns({ create: createStub });
            registry.putActiveGraphSync = sinon.stub();
            registry.fetchGraphDefinitionCatalog = sinon.stub().resolves([
                { injectableName: 'Test.Graph', friendlyName: 'Test Graph Friendly Name' }
            ]);
            registry.hasActiveGraphSync = sinon.stub().returns(false);
        });

        it('should reject if there is an existing graph against a specified target', function() {
            registry.hasActiveGraphSync = sinon.stub().returns(true);
            return expect(tgSubscriptions.runTaskGraph('TestGraph', {}, 'target'))
                .to.be.rejectedWith(/Unable to run multiple task graphs against a single target/);
        });

        it('should reject if the graph name does not exist', function() {
            registry.fetchGraphDefinitionCatalog = sinon.stub().resolves([ ]);
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
        var childInjector;
        var registry;
        var tgSubscriptions;
        beforeEach(function() {
            childInjector = injector.createChild([
                helper.require('/lib/task-graph-subscriptions'),
                helper.require('/lib/registry')
            ]);
            registry = childInjector.get('TaskGraph.Registry');
            tgSubscriptions = childInjector.get('TaskGraph.Subscriptions');
        });

        it('should get the task graph library', function() {
            var filter = { filter: 'filter' };
            registry.fetchGraphDefinitionCatalog = sinon.stub();
            tgSubscriptions.getTaskGraphLibrary(filter);
            expect(registry.fetchGraphDefinitionCatalog).to.have.been.calledWith(filter);
        });

        it('should get the task library', function() {
            var filter = { filter: 'filter' };
            registry.fetchTaskDefinitionCatalog = sinon.stub();
            tgSubscriptions.getTaskLibrary(filter);
            expect(registry.fetchTaskDefinitionCatalog).to.have.been.calledWith(filter);
        });

        it('should get an active task graph', function() {
            var filter = { filter: 'filter' };
            var graphStubObj = {
                status: sinon.stub().returns('running')
            };
            registry.fetchActiveGraphSync = sinon.stub().returns(graphStubObj);
            expect(tgSubscriptions.getActiveTaskGraph(filter)).to.equal('running');
            expect(registry.fetchActiveGraphSync).to.have.been.calledWith(filter);
            expect(graphStubObj.status).to.have.been.calledOnce;
        });

        it('should return undefined when there is no active task graph for filter', function() {
            var filter = { filter: 'filter' };
            registry.fetchActiveGraphSync = sinon.stub().returns(undefined);
            expect(tgSubscriptions.getActiveTaskGraph(filter)).to.be.undefined;
        });

        it('should get active task graphs', function() {
            var filter = { filter: 'filter' };
            var graphStubObj = {
                status: sinon.stub().returns('running')
            };
            var graphStubObjects = [graphStubObj, graphStubObj, graphStubObj];

            registry.fetchActiveGraphsSync = sinon.stub().returns(graphStubObjects);
            var graphStatuses = tgSubscriptions.getActiveTaskGraphs(filter);
            expect(graphStatuses).to.deep.equal(['running', 'running', 'running']);
            expect(registry.fetchActiveGraphsSync).to.have.been.calledWith(filter);
            expect(graphStubObj.status).to.have.been.calledThrice;
        });
    });

    describe('task/graph definitions', function() {
        var childInjector;
        var registry;
        var tgSubscriptions;
        var TaskGraph;
        var Task;
        beforeEach(function() {
            childInjector = injector.createChild([
                helper.require('/lib/task-graph-subscriptions'),
                helper.require('/lib/registry'),
                helper.require('/lib/task-graph')
            ]);
            registry = childInjector.get('TaskGraph.Registry');
            tgSubscriptions = childInjector.get('TaskGraph.Subscriptions');
            TaskGraph = childInjector.get('TaskGraph.TaskGraph');
            Task = childInjector.get('Task.Task');
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
            registry.registerGraph = sinon.stub();
            TaskGraph.createRegistryObject = sinon.stub().returns('graph object');
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
            registry.registerTask = sinon.stub();
            Task.createRegistryObject = sinon.stub().returns('task object');
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
