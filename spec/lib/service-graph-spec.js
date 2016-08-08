// Copyright 2016, EMC, Inc.

'use strict';

describe('Service Graph', function () {
    var Constants,
        serviceGraph,
        graphDefinitions,
        graph;

    var store = {
        getGraphDefinitions: sinon.stub(),
        getServiceGraphs: sinon.stub(),
        deleteGraph: sinon.stub().resolves()
    };

    var taskGraphProtocol = {
        runTaskGraph: sinon.stub(),
        cancelTaskGraph: sinon.stub()
    };

    var TaskGraph = {
        create: sinon.stub()
    };

    before(function() {
        helper.setupInjector(
            _.flattenDeep([
                helper.require('/lib/service-graph'),
                helper.di.simpleWrapper(TaskGraph, 'TaskGraph.TaskGraph'),
                helper.di.simpleWrapper(taskGraphProtocol, 'Protocol.TaskGraphRunner'),
                helper.di.simpleWrapper(store, 'TaskGraph.Store')
            ])
        );
        serviceGraph = helper.injector.get('TaskGraph.ServiceGraph');
        store = helper.injector.get('TaskGraph.Store');
        Constants = helper.injector.get('Constants');
        this.sandbox = sinon.sandbox.create();
    });

    beforeEach(function() {
        graphDefinitions = [
            { injectableName: 'testGraph1', serviceGraph: true },
            { injectableName: 'testGraph2' },
            { injectableName: 'testGraph3', serviceGraph: true }
        ];
        graph = {
                injectableName: 'testGraph1',
                serviceGraph: true,
                instanceId: 'testid1',
                _status: Constants.Task.States.Running,
                definition: graphDefinitions[0]
        };
        this.sandbox.stub(serviceGraph, 'createAndRunServiceGraph').resolves();
    });

    afterEach(function() {
        store.getGraphDefinitions.reset();
        store.getServiceGraphs.reset();
        store.deleteGraph.reset();
        taskGraphProtocol.cancelTaskGraph.reset();
        taskGraphProtocol.runTaskGraph.reset();
        this.sandbox.restore();
    });

    it('should stop', function() {
        store.getGraphDefinitions.resolves(graphDefinitions);
        var graphs = [
            { instanceId: 'testid1' },
            { instanceId: 'testid2' },
            { instanceId: 'testid3' }
        ];
        store.getServiceGraphs.resolves(graphs);

        return serviceGraph.stop()
        .then(function() {
            expect(taskGraphProtocol.cancelTaskGraph).to.have.been.calledThrice;
            expect(taskGraphProtocol.cancelTaskGraph).to.have.been.calledWith('testid1');
            expect(taskGraphProtocol.cancelTaskGraph).to.have.been.calledWith('testid2');
            expect(taskGraphProtocol.cancelTaskGraph).to.have.been.calledWith('testid3');
        });
    });

    it('should find service graph definitions and start them', function() {
        store.getGraphDefinitions.resolves(graphDefinitions);
        store.getServiceGraphs.resolves([]);

        return serviceGraph.start('default')
        .then(function() {
            expect(store.getGraphDefinitions).to.have.been.calledOnce;
            expect(store.getServiceGraphs).to.have.been.calledOnce;

            expect(serviceGraph.createAndRunServiceGraph).to.have.been.calledTwice;
            expect(serviceGraph.createAndRunServiceGraph).to.have.been.calledWith(
                graphDefinitions[0],
                'default'
            );
            expect(serviceGraph.createAndRunServiceGraph).to.have.been.calledWith(
                graphDefinitions[2],
                'default'
            );
        });
    });

    it('should restart service graphs that have failed', function() {
        graph._status = Constants.Task.States.Failed;
        store.getGraphDefinitions.resolves([ graphDefinitions[0] ]);
        store.getServiceGraphs.resolves([ graph ]);

        return serviceGraph.start('default')
        .then(function() {
            expect(store.deleteGraph).to.have.been.calledOnce;
            expect(store.deleteGraph).to.have.been.calledWith('testid1');
            expect(serviceGraph.createAndRunServiceGraph).to.have.been.calledOnce;
            expect(serviceGraph.createAndRunServiceGraph)
                .to.have.been.calledWith(graphDefinitions[0]);
        });
    });

    it('should not cancel identical graphs that are already running', function() {
        store.getGraphDefinitions.resolves([ graphDefinitions[0] ]);
        store.getServiceGraphs.resolves([ graph ]);

        return serviceGraph.start('default')
        .then(function() {
            expect(store.deleteGraph).to.not.have.been.calledOnce;
            expect(taskGraphProtocol.cancelTaskGraph).to.not.have.been.calledOnce;
        });
    });

    it('should cancel/delete service graphs with a changed definition', function() {
        graph.definition = _.cloneDeep(graphDefinitions[0]);
        graphDefinitions[0].nonEqualityProperty = true;
        store.getGraphDefinitions.resolves([ graphDefinitions[0] ]);
        store.getServiceGraphs.resolves([ graph ]);
        taskGraphProtocol.cancelTaskGraph.resolves();

        return serviceGraph.start('default')
        .then(function() {
            expect(store.deleteGraph).to.have.been.calledOnce;
            expect(store.deleteGraph).to.have.been.calledWith('testid1');
            expect(taskGraphProtocol.cancelTaskGraph).to.have.been.calledOnce;
            expect(taskGraphProtocol.cancelTaskGraph).to.have.been.calledWith('testid1');
        });
    });

    it('should cancel/delete service graphs that no longer have a definition', function() {
        store.getGraphDefinitions.resolves([]);
        store.getServiceGraphs.resolves([ graph ]);
        taskGraphProtocol.cancelTaskGraph.resolves();

        return serviceGraph.start('default')
        .then(function() {
            expect(store.deleteGraph).to.have.been.calledOnce;
            expect(store.deleteGraph).to.have.been.calledWith('testid1');
            expect(taskGraphProtocol.cancelTaskGraph).to.have.been.calledOnce;
            expect(taskGraphProtocol.cancelTaskGraph).to.have.been.calledWith('testid1');
        });
    });

    it('should create a service graph', function() {
        serviceGraph.createAndRunServiceGraph.restore();
        var persistStub = sinon.stub().resolves({ instanceId: 'testid' });
        TaskGraph.create.resolves({ persist: persistStub });
        taskGraphProtocol.runTaskGraph.resolves();

        return serviceGraph.createAndRunServiceGraph(graphDefinitions[0], 'default')
        .then(function() {
            expect(TaskGraph.create).to.have.been.calledOnce;
            expect(TaskGraph.create).to.have.been.calledWith('default', {
                definition: graphDefinitions[0]
            });
            expect(persistStub).to.have.been.calledOnce;
            expect(taskGraphProtocol.runTaskGraph).to.have.been.calledOnce;
            expect(taskGraphProtocol.runTaskGraph).to.have.been.calledWith('testid');
        });
    });

    it('should not create duplicate service graphs', function() {
        store.getGraphDefinitions.resolves([ graphDefinitions[0] ]);
        store.getServiceGraphs.resolves([ graph ]);

        return serviceGraph.start('default')
        .then(function() {
            expect(serviceGraph.createAndRunServiceGraph).to.not.have.been.called;
        });
    });
});
