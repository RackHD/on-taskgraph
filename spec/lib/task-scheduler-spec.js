// Copyright 2016, EMC, Inc.

'use strict';

describe('Task Scheduler', function() {
    var TaskScheduler;
    var TaskGraph;
    var LeaseExpirationPoller;
    var taskMessenger;
    var store;
    var assert;
    var Constants;
    var Promise;
    var Rx;

    var asyncAssertWrapper = function(done, cb) {
        return function(data) {
            try {
                cb(data);
                done();
            } catch (e) {
                done(e);
            }
        };
    };

    var streamSuccessWrapper = function(stream, done, cb) {
        stream.subscribe(
            asyncAssertWrapper(done, cb),
            done,
            function() { }
        );
    };

    var streamCompletedWrapper = function(stream, done, cb) {
        stream.subscribe(
            function() { },
            done,
            asyncAssertWrapper(done, cb)
        );
    };


    before(function() {
        var di = require('di');
        var tasks = require('on-tasks');
        var core = require('on-core')(di, __dirname);

        helper.setupInjector(_.flattenDeep([
            core.workflowInjectables,
            tasks.injectables,
            require('../../lib/task-scheduler'),
            require('../../lib/lease-expiration-poller'),
            require('../../lib/rx-mixins')
        ]));
        assert = helper.injector.get('Assert');
        Constants = helper.injector.get('Constants');
        taskMessenger = helper.injector.get('Task.Messenger');
        TaskScheduler = helper.injector.get('TaskGraph.TaskScheduler');
        TaskGraph = helper.injector.get('TaskGraph.TaskGraph');
        LeaseExpirationPoller = helper.injector.get('TaskGraph.LeaseExpirationPoller');
        store = helper.injector.get('TaskGraph.Store');
        Rx = helper.injector.get('Rx');
        Promise = helper.injector.get('Promise');
        this.sandbox = sinon.sandbox.create();
    });

    beforeEach(function() {
        this.sandbox.stub(TaskScheduler.prototype, 'handleStreamError');
        this.sandbox.stub(TaskScheduler.prototype, 'handleStreamSuccess');
        this.sandbox.stub(taskMessenger, 'subscribeRunTaskGraph').resolves({});
        this.sandbox.stub(taskMessenger, 'subscribeTaskFinished').resolves({});
        this.sandbox.stub(LeaseExpirationPoller, 'create').returns({
            start: sinon.stub(),
            stop: sinon.stub()
        });
    });

    afterEach(function() {
        this.sandbox.restore();
    });

    describe('Task Scheduler', function() {
        var taskScheduler;

        beforeEach(function() {
            taskScheduler = TaskScheduler.create();
        });

        it('should be created with default values', function() {
            expect(taskScheduler.running).to.equal(false);
            expect(assert.uuid.bind(assert, taskScheduler.schedulerId)).to.not.throw(Error);
            expect(taskScheduler.domain).to.equal(Constants.DefaultTaskDomain);
            expect(taskScheduler.evaluateTaskStream).to.be.an.instanceof(Rx.Subject);
            expect(taskScheduler.evaluateGraphStream).to.be.an.instanceof(Rx.Subject);
            expect(taskScheduler.checkGraphFinishedStream).to.be.an.instanceof(Rx.Subject);
            expect(taskScheduler.pollInterval).to.equal(500);
            expect(taskScheduler.concurrencyMaximums).to.deep.equal(
                {
                    findReadyTasks: { count: 0, max: 100 },
                    updateTaskDependencies: { count: 0, max: 100 },
                    handleScheduleTaskEvent: { count: 0, max: 100 },
                    completeGraphs: { count: 0, max: 100 },
                    findUnevaluatedTasks: { count: 0, max: 1 }
                }
            );
            expect(taskScheduler.subscriptions).to.deep.equal([]);
            expect(taskScheduler.leasePoller).to.equal(null);
            expect(taskScheduler.debug).to.equal(false);
        });

        it('start', function() {
            var stub = sinon.stub();
            this.sandbox.stub(taskScheduler, 'subscribeRunTaskGraph').resolves(stub);
            this.sandbox.stub(taskScheduler, 'subscribeTaskFinished').resolves(stub);
            return taskScheduler.start()
            .then(function() {
                expect(taskScheduler.running).to.equal(true);
                expect(taskScheduler.leasePoller.running).to.equal(true);
                expect(taskScheduler.subscriptions).to.deep.equal([stub, stub]);
            });
        });


        it('stop', function() {
            var runTaskGraphDisposeStub = sinon.stub().resolves();
            var taskFinishedDisposeStub = sinon.stub().resolves();
            this.sandbox.stub(taskScheduler, 'subscribeRunTaskGraph').resolves({
                dispose: runTaskGraphDisposeStub
            });
            this.sandbox.stub(taskScheduler, 'subscribeTaskFinished').resolves({
                dispose: taskFinishedDisposeStub
            });
            return taskScheduler.start()
            .then(function() {
                return taskScheduler.stop();
            })
            .then(function() {
                expect(taskScheduler.running).to.equal(false);
                expect(taskScheduler.leasePoller.running).to.equal(false);
                expect(runTaskGraphDisposeStub).to.have.been.calledOnce;
                expect(taskFinishedDisposeStub).to.have.been.calledOnce;
            });
        });

        it('stream success handler should return an observable', function() {
            taskScheduler.handleStreamSuccess.restore();
            expect(taskScheduler.handleStreamSuccess()).to.be.an.instanceof(Rx.Observable);
        });

        it('stream error handler should return an empty observable', function() {
            taskScheduler.handleStreamError.restore();
            expect(taskScheduler.handleStreamError('test', {})).to.be.an.instanceof(Rx.Observable);
        });

        describe('createTasksToScheduleSubscription', function() {
            var readyTaskStream;
            var subscription;

            before(function() {
                readyTaskStream = new Rx.Subject();
            });

            beforeEach(function() {
                this.sandbox.stub(store, 'checkoutTaskForScheduler');
                this.sandbox.stub(taskScheduler, 'scheduleTaskHandler');
                taskScheduler.handleStreamError.returns(Rx.Observable.empty());
                subscription = taskScheduler.createTasksToScheduleSubscription(readyTaskStream);
            });

            afterEach(function() {
                subscription.dispose();
            });

            it('should not flow if scheduler is not running', function(done) {
                taskScheduler.running = false;
                readyTaskStream.onNext({});

                setImmediateAssertWrapper(done, function() {
                    expect(store.checkoutTaskForScheduler).to.not.have.been.called;
                });
            });

            it('should filter if no tasks are found', function(done) {
                store.checkoutTaskForScheduler.resolves({});

                readyTaskStream.onNext({ tasks: [] });
                readyTaskStream.onNext({ tasks: [] });
                readyTaskStream.onNext({ tasks: [] });

                setImmediateAssertWrapper(done, function() {
                    expect(store.checkoutTaskForScheduler).to.not.have.been.called;
                });
            });

            it('should filter if a task was not checked out', function(done) {
                store.checkoutTaskForScheduler.resolves(null);

                readyTaskStream.onNext({ tasks: [ {}, {}, {} ] });
                readyTaskStream.onNext({ tasks: [ {}, {}, {} ] });
                readyTaskStream.onNext({ tasks: [ {}, {}, {} ] });

                setImmediateAssertWrapper(done, function() {
                    expect(store.checkoutTaskForScheduler.callCount).to.equal(9);
                    expect(taskScheduler.scheduleTaskHandler).to.not.have.been.called;
                });
            });

            it('should schedule ready tasks for a graph', function(done) {
                var out = { instanceId: 'testid' };
                taskScheduler.scheduleTaskHandler.resolves();
                store.checkoutTaskForScheduler.returns(Rx.Observable.repeat(out, 3));

                readyTaskStream.onNext({ tasks: [ {} ] });

                setImmediateAssertWrapper(done, function() {
                    expect(store.checkoutTaskForScheduler).to.have.been.called;
                    expect(taskScheduler.scheduleTaskHandler.callCount).to.equal(3);
                    expect(taskScheduler.scheduleTaskHandler).to.have.been.calledWith(out);
                });
            });

            it('should handle stream successes', function(done) {
                var out = { instanceId: 'testid' };
                store.checkoutTaskForScheduler.resolves(out);
                taskScheduler.scheduleTaskHandler.resolves(out);
                readyTaskStream.onNext({ tasks: [ {} ] });

                setImmediateAssertWrapper(done, function() {
                    expect(taskScheduler.handleStreamSuccess).to.have.been.calledOnce;
                    expect(taskScheduler.handleStreamSuccess)
                        .to.have.been.calledWith('Task scheduled', out);
                });
            });

            it('should handle stream errors', function(done) {
                var testError = new Error('test');
                store.checkoutTaskForScheduler.rejects(testError);

                readyTaskStream.onNext({ tasks: [ {} ] });

                setImmediateAssertWrapper(done, function() {
                    expect(taskScheduler.handleStreamError).to.have.been.calledWith(
                        'Error scheduling task',
                        testError
                    );
                });
            });
        });

    });

    describe('createUpdateTaskDependenciesSubscription', function() {
        var taskScheduler;
        var taskHandlerStream;
        var subscription;
        var checkGraphFinishedStream;
        var evaluateGraphStream;

        before(function() {
            taskHandlerStream = new Rx.Subject();
        });

        beforeEach(function() {
            this.sandbox.stub(store, 'setTaskStateInGraph').resolves();
            this.sandbox.stub(store, 'updateDependentTasks').resolves();
            this.sandbox.stub(store, 'updateUnreachableTasks').resolves();
            this.sandbox.stub(store, 'markTaskEvaluated');

            evaluateGraphStream = new Rx.Subject();
            checkGraphFinishedStream = new Rx.Subject();
            this.sandbox.stub(evaluateGraphStream, 'onNext');
            this.sandbox.stub(checkGraphFinishedStream, 'onNext');

            taskScheduler = TaskScheduler.create();
            taskScheduler.running = true;

            subscription = taskScheduler.createUpdateTaskDependenciesSubscription(
                taskHandlerStream,
                evaluateGraphStream,
                checkGraphFinishedStream
            );
        });

        afterEach(function() {
            checkGraphFinishedStream.dispose();
            evaluateGraphStream.dispose();
        });

        it('should not flow if scheduler is not running', function(done) {
            this.sandbox.stub(taskScheduler, 'updateTaskDependencies');
            taskScheduler.subscriptions = [];

            return taskScheduler.stop()
            .then(function() {
                streamCompletedWrapper(subscription, done, function() {
                    expect(taskScheduler.updateTaskDependencies).to.not.have.been.called;
                });
                taskHandlerStream.onNext({});
            });
        });

        it('should check if a graph is finished on a terminal task state', function(done) {
            var data = {
                terminalOnStates: ['succeeded'],
                state: 'succeeded'
            };
            store.markTaskEvaluated.resolves(data);

            streamSuccessWrapper(subscription, done, function() {
                expect(checkGraphFinishedStream.onNext).to.have.been.calledOnce;
                expect(checkGraphFinishedStream.onNext).to.have.been.calledWith(data);
            });

            taskHandlerStream.onNext({});
        });

        it('should check for ready tasks in a graph if a task is non-terminal', function(done) {
            var data = {
                terminalOnStates: ['failed'],
                state: 'succeeded',
                graphId: 'testgraphid'
            };
            store.markTaskEvaluated.resolves(data);

            streamSuccessWrapper(subscription, done, function() {
                expect(evaluateGraphStream.onNext).to.have.been.calledOnce;
                expect(evaluateGraphStream.onNext).to.have.been.calledWith({
                    graphId: 'testgraphid'
                });
            });

            taskHandlerStream.onNext({});
        });

        it('should update dependent and unreachable tasks on handled task failures',
                function(done) {
            var data = {
                unhandledFailure: false
            };
            store.markTaskEvaluated.resolves(data);
            taskHandlerStream.onNext(data);

            setImmediateAssertWrapper(done, function() {
                expect(taskScheduler.evaluateGraphStream.onNext).to.have.been.calledOnce;
                expect(taskScheduler.evaluateGraphStream.onNext)
                    .to.have.been.calledWith(data);
            });
        });

        it('should handle errors related to updating task dependencies', function(done) {
            var testError = new Error('test update dependencies error');
            store.updateDependentTasks.rejects(testError);
            taskHandlerStream.onNext({ unhandledFailure: false });

            setImmediateAssertWrapper(done, function() {
                expect(taskScheduler.handleStreamError).to.have.been.calledOnce;
                expect(taskScheduler.handleStreamError).to.have.been.calledWith(
                    'Error updating task dependencies',
                    testError
                );
            });
        });

        it('should handle errors related to marking a task as evaluated', function(done) {
            var testError = new Error('test mark task evaluated error');
            store.markTaskEvaluated.rejects(testError);
            taskHandlerStream.onNext({ unhandledFailure: false });

            setImmediateAssertWrapper(done, function() {
                expect(taskScheduler.handleStreamError).to.have.been.calledOnce;
                expect(taskScheduler.handleStreamError).to.have.been.calledWith(
                    'Error updating task dependencies',
                    testError
                );
            });
        });
    });

    describe('createStartTaskGraphSubscription', function() {
        var startGraphStream;
        var subscription;
        var taskScheduler;

        before(function() {
            startGraphStream = new Rx.Subject();
            taskScheduler = TaskScheduler.create();
        });

        beforeEach(function() {
            this.sandbox.stub(TaskGraph, 'create').resolves();
            this.sandbox.stub(TaskGraph.prototype, 'createTaskDependencyItems');
            this.sandbox.stub(store, 'persistGraphObject').resolves();
            this.sandbox.stub(store, 'persistTaskDependencies').resolves();
            this.sandbox.stub(taskScheduler.evaluateGraphStream, 'onNext');
            subscription = taskScheduler.createStartTaskGraphSubscription(startGraphStream);
        });

        afterEach(function() {
            subscription.dispose();
        });

        it('should not flow if scheduler is not running', function(done) {
            taskScheduler.running = false;
            startGraphStream.onNext({});

            setImmediateAssertWrapper(done, function() {
                expect(TaskGraph.create).to.not.have.been.called;
            });
        });

        it('should create and persist a graph', function(done) {
            var data = { instanceId: 'testid' };
            var graph = { instanceId: 'testid' };
            graph.createTaskDependencyItems = TaskGraph.prototype.createTaskDependencyItems;
            var items = [{}, {}, {}];
            TaskGraph.create.resolves(graph);
            TaskGraph.prototype.createTaskDependencyItems.resolves(items);
            store.persistTaskDependencies.resolves();

            startGraphStream.onNext(data);

            setImmediateAssertWrapper(done, function() {
                expect(TaskGraph.create).to.have.been.calledOnce;
                expect(TaskGraph.create).to.have.been.calledWith(data);
                expect(store.persistGraphObject).to.have.been.calledOnce;
                expect(store.persistGraphObject).to.have.been.calledWith(graph);
                expect(TaskGraph.prototype.createTaskDependencyItems).to.have.been.calledOnce;
                expect(store.persistTaskDependencies).to.have.been.calledThrice;
                _.forEach(items, function(item) {
                    expect(store.persistTaskDependencies)
                        .to.have.been.calledWith(item, graph.instanceId);
                });
                expect(taskScheduler.evaluateGraphStream.onNext).to.have.been.calledOnce;
                expect(taskScheduler.evaluateGraphStream.onNext).to.have.been.calledWith({
                    graphId: graph.instanceId
                });
            });
        });

        it('should handle errors related to starting graphs', function(done) {
            var testError = new Error('test start graph error');
            TaskGraph.create.rejects(testError);
            startGraphStream.onNext();

            setImmediateAssertWrapper(done, function() {
                expect(taskScheduler.handleStreamError).to.have.been.calledOnce;
                expect(taskScheduler.handleStreamError).to.have.been.calledWith(
                    'Error starting task graph',
                    testError
                );
            });
        });
    });

    describe('createGraphDoneSubscription', function() {
        var taskScheduler;
        var readyTaskStream;
        var subscription;

        before(function() {
            readyTaskStream = new Rx.Subject();
            taskScheduler = TaskScheduler.create();
        });

        beforeEach(function() {
            this.sandbox.stub(store, 'checkGraphDone').resolves();
            this.sandbox.stub(store, 'setGraphDone').resolves();
            this.sandbox.stub(taskScheduler, 'publishGraphFinished').resolves();
            subscription = taskScheduler.createGraphDoneSubscription(readyTaskStream);
        });

        afterEach(function() {
            subscription.dispose();
        });

        it('should not flow if scheduler is not running', function(done) {
            taskScheduler.running = false;
            readyTaskStream.onNext({});

            setImmediateAssertWrapper(done, function() {
                expect(store.checkGraphDone).to.not.have.been.called;
            });
        });

        it('should filter if tasks is not empty', function(done) {
            var data = {
                tasks: [{}, {}]
            };
            readyTaskStream.onNext(data);

            setImmediateAssertWrapper(done, function() {
                expect(store.checkGraphDone).to.not.have.been.called;
                expect(store.setGraphDone).to.not.have.been.called;
                expect(taskScheduler.publishGraphFinished).to.not.have.been.called;
                expect(taskScheduler.handleStreamSuccess).to.not.have.been.called;
            });
        });

        it('should filter if the graph is not done', function(done) {
            var data = {
                tasks: []
            };
            store.checkGraphDone.resolves({ done: false });
            readyTaskStream.onNext(data);

            setImmediateAssertWrapper(done, function() {
                expect(store.checkGraphDone).to.have.been.calledOnce;
                expect(store.setGraphDone).to.not.have.been.called;
                expect(taskScheduler.publishGraphFinished).to.not.have.been.called;
                expect(taskScheduler.handleStreamSuccess).to.not.have.been.called;
            });
        });

        it('should publish if a graph is done', function(done) {
            var data1 = {};
            var data2 = { done: true };
            var data3 = { instanceId: 'testid', _status: 'test', ignore: 'ignore' };
            var data4 = _.omit(data3, ['ignore']);
            store.checkGraphDone.resolves(data2);
            store.setGraphDone.resolves(data3);
            taskScheduler.publishGraphFinished.resolves(data4);
            readyTaskStream.onNext(data1);

            setImmediateAssertWrapper(done, function() {
                expect(store.checkGraphDone).to.have.been.calledOnce;
                expect(store.checkGraphDone).to.have.been.calledWith(data1);
                expect(store.setGraphDone).to.have.been.calledOnce;
                expect(store.setGraphDone)
                    .to.have.been.calledWith(Constants.TaskStates.Succeeded, data2);
                expect(taskScheduler.publishGraphFinished).to.have.been.calledOnce;
                expect(taskScheduler.publishGraphFinished)
                    .to.have.been.calledWith(data4);
                expect(taskScheduler.handleStreamSuccess).to.have.been.calledOnce;
                expect(taskScheduler.handleStreamSuccess)
                    .to.have.been.calledWith('Graph finished', data4);
            });
        });

        it('should handle stream errors', function(done) {
            var testError = new Error('test check graph done error');
            store.checkGraphDone.rejects(testError);
            readyTaskStream.onNext();

            setImmediateAssertWrapper(done, function() {
                expect(taskScheduler.handleStreamError).to.have.been.calledOnce;
                expect(taskScheduler.handleStreamError).to.have.been.calledWith(
                    'Error checking graph done',
                    testError
                );
            });
        });
    });
});
