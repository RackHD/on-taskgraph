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

    /*
     * Helper methods to test inner stream creation methods.
     * Since the class methods all return cold Observables, we can
     * hijack the subscribe methods to those we control in the unit test.
     * Since this is async, we have to use the Chai framework's done
     * callback, so basically what we're doing is adding a helper method that does:

     * Subscribe to the stream completed event (thus starting it), and on that
     * event run a callback that includes our test assertions, and calls the
     * done callback appropriately so that we can pass or fail the test.
    */

    var streamSuccessWrapper = function(stream, done, cb) {
        var subscription = {};
        subscription.subsription = stream.subscribe(
            asyncAssertWrapper(done, cb, subscription),
            done,
            function() { }
        );
    };

    var streamCompletedWrapper = function(stream, done, cb) {
        var subscription = {};
        subscription.subscription = stream.subscribe(
            function () {},
            done,
            asyncAssertWrapper(done, cb, subscription)
        );
    };

    var asyncAssertWrapper = function(done, cb, subscription) {
        return function(data) {
            try {
                cb(data);
                if (subscription && subscription.subscription) {
                    subscription.subscription.dispose();
                }
                done();
            } catch (e) {
                done(e);
            }
        };
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
        this.sandbox.spy(TaskScheduler.prototype, 'handleStreamError');
        this.sandbox.spy(TaskScheduler.prototype, 'handleStreamSuccess');
        this.sandbox.stub(taskMessenger, 'subscribeRunTaskGraph').resolves({});
        this.sandbox.stub(taskMessenger, 'subscribeTaskFinished').resolves({});
        this.sandbox.stub(taskMessenger, 'subscribeCancelGraph').resolves({});
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
            expect(taskScheduler.domain).to.equal(Constants.Task.DefaultDomain);
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
            expect(taskScheduler.findUnevaluatedTasksLimit).to.equal(200);
            expect(taskScheduler.subscriptions).to.deep.equal([]);
            expect(taskScheduler.leasePoller).to.equal(null);
            expect(taskScheduler.debug).to.equal(false);
        });

        it('should be created with optional values', function() {
            taskScheduler = TaskScheduler.create({
                domain: 'testdomain',
                schedulerId: 'testid',
                debug: true,
                findUnevaluatedTasksLimit: 100,
                pollInterval: 2000,
                concurrent: {
                    findReadyTasks: 25,
                    updateTaskDependencies: 25,
                    handleScheduleTaskEvent: 25,
                    completeGraphs: 25,
                    findUnevaluatedTasks: 0
                }
            });
            expect(taskScheduler.concurrencyMaximums).to.deep.equal(
                {
                    findReadyTasks: { count: 0, max: 25 },
                    updateTaskDependencies: { count: 0, max: 25 },
                    handleScheduleTaskEvent: { count: 0, max: 25 },
                    completeGraphs: { count: 0, max: 25 },
                    findUnevaluatedTasks: { count: 0, max: 0 }
                }
            );
            expect(taskScheduler.domain).to.equal('testdomain');
            expect(taskScheduler.schedulerId).to.equal('testid');
            expect(taskScheduler.debug).to.equal(true);
            expect(taskScheduler.pollInterval).to.equal(2000);
            expect(taskScheduler.findUnevaluatedTasksLimit).to.equal(100);
        });

        it('start', function() {
            var stub = sinon.stub();
            this.sandbox.stub(taskScheduler, 'subscribeRunTaskGraph').resolves(stub);
            this.sandbox.stub(taskScheduler, 'subscribeTaskFinished').resolves(stub);
            this.sandbox.stub(taskScheduler, 'subscribeCancelGraph').resolves(stub);
            return taskScheduler.start()
            .then(function() {
                expect(taskScheduler.running).to.equal(true);
                expect(LeaseExpirationPoller.create).to.have.been.calledOnce;
                expect(taskScheduler.leasePoller.start).to.have.been.calledOnce;
                expect(taskScheduler.subscriptions).to.deep.equal([stub, stub, stub]);
            });
        });


        it('stop', function() {
            var runTaskGraphDisposeStub = sinon.stub().resolves();
            var taskFinishedDisposeStub = sinon.stub().resolves();
            var cancelGraphDisposeStub = sinon.stub().resolves();
            this.sandbox.stub(taskScheduler, 'subscribeRunTaskGraph').resolves({
                dispose: runTaskGraphDisposeStub
            });
            this.sandbox.stub(taskScheduler, 'subscribeTaskFinished').resolves({
                dispose: taskFinishedDisposeStub
            });
            this.sandbox.stub(taskScheduler, 'subscribeCancelGraph').resolves({
                dispose: cancelGraphDisposeStub
            });
            return taskScheduler.start()
            .then(function() {
                return taskScheduler.stop();
            })
            .then(function() {
                expect(taskScheduler.running).to.equal(false);
                expect(taskScheduler.leasePoller.stop).to.have.been.calledOnce;
                expect(taskScheduler.subscriptions.length).to.equal(0);
                expect(runTaskGraphDisposeStub).to.have.been.calledOnce;
                expect(taskFinishedDisposeStub).to.have.been.calledOnce;
            });
        });

        it('isRunning', function() {
            taskScheduler.running = false;
            expect(taskScheduler.isRunning()).to.equal(false);
            taskScheduler.running = true;
            expect(taskScheduler.isRunning()).to.equal(true);
        });

        it('stream success handler should return an observable', function() {
            taskScheduler.handleStreamSuccess.restore();
            expect(taskScheduler.handleStreamSuccess('test', {}))
                .to.be.an.instanceof(Rx.Observable);
        });

        it('stream error handler should return an empty observable', function() {
            taskScheduler.handleStreamError.restore();
            expect(taskScheduler.handleStreamError('test', new Error('test')))
                .to.be.an.instanceof(Rx.Observable);
        });

        it('stream debug handler should work', function() {
            taskScheduler.handleStreamError.restore();
            taskScheduler.debug = true;
            taskScheduler.handleStreamDebug('test', {});
        });

        it('subscribeTaskFinished should emit to evaluateTaskStream', function() {
            this.sandbox.spy(taskScheduler.evaluateTaskStream, 'onNext');
            var data = {};
            taskMessenger.subscribeTaskFinished.resolves(data);
            return taskScheduler.subscribeTaskFinished()
            .then(function() {
                expect(taskMessenger.subscribeTaskFinished).to.have.been.calledOnce;
                expect(taskMessenger.subscribeTaskFinished)
                    .to.have.been.calledWith(taskScheduler.domain);
                var cb = taskMessenger.subscribeTaskFinished.firstCall.args[1];
                cb(data);
                expect(taskScheduler.evaluateTaskStream.onNext).to.have.been.calledOnce;
                expect(taskScheduler.evaluateTaskStream.onNext).to.have.been.calledWith(data);
            });
        });

        it('publishGraphFinished should publish with the events protocol', function() {
            var eventsProtocol = helper.injector.get('Protocol.Events');
            this.sandbox.stub(eventsProtocol, 'publishGraphFinished').resolves();
            var graph = { instanceId: 'testgraphid', _status: 'succeeded' };
            return taskScheduler.publishGraphFinished(graph)
            .then(function() {
                expect(eventsProtocol.publishGraphFinished).to.have.been.calledOnce;
                expect(eventsProtocol.publishGraphFinished)
                    .to.have.been.calledWith('testgraphid', 'succeeded');
            });
        });

        it('publishScheduleTaskEvent should publish a run task event', function() {
            this.sandbox.stub(taskMessenger, 'publishRunTask').resolves({});
            var data = { taskId: 'testtaskid', graphId: 'testgraphid' };
            return taskScheduler.publishScheduleTaskEvent(data)
            .then(function() {
                expect(taskMessenger.publishRunTask).to.have.been.calledOnce;
                expect(taskMessenger.publishRunTask)
                    .to.have.been.calledWith(taskScheduler.domain, 'testtaskid', 'testgraphid');
            });
        });

        it('subscribeRunTaskGraph should emit to evaluateGraphStream', function() {
            var uuid = helper.injector.get('uuid');
            var data = { graphId: uuid.v4() };
            this.sandbox.spy(taskScheduler.evaluateGraphStream, 'onNext');
            return taskScheduler.subscribeRunTaskGraph()
            .then(function() {
                expect(taskMessenger.subscribeRunTaskGraph).to.have.been.calledOnce;
                expect(taskMessenger.subscribeRunTaskGraph)
                    .to.have.been.calledWith(taskScheduler.domain);
                var cb = taskMessenger.subscribeRunTaskGraph.firstCall.args[1];
                cb(data);
                expect(taskScheduler.evaluateGraphStream.onNext).to.have.been.calledOnce;
                expect(taskScheduler.evaluateGraphStream.onNext).to.have.been.calledWith(data);
            });
        });

        describe('createUnevaluatedTaskPollerSubscription', function() {
            var observable;

            beforeEach(function() {
                this.sandbox.stub(taskScheduler.evaluateTaskStream, 'onNext');
                this.sandbox.stub(store, 'findUnevaluatedTasks').resolves([]);
                taskScheduler.pollInterval = 1;
                taskScheduler.running = true;
                observable = taskScheduler.createUnevaluatedTaskPollerSubscription(
                                    taskScheduler.evaluateTaskStream);
            });

            it('should emit unevaluated tasks to evaluateTaskStream', function(done) {
                var tasks = [ { taskId: 'taskid1' }, { taskId: 'taskid2' }, { taskId: 'taskid3' } ];
                store.findUnevaluatedTasks.resolves([]);
                store.findUnevaluatedTasks.onFirstCall().resolves(tasks);

                observable = observable.take(3);

                streamCompletedWrapper(observable, done, function() {
                    expect(store.findUnevaluatedTasks).to.have.been.calledOnce;
                    expect(store.findUnevaluatedTasks).to.have.been.calledWith(
                        taskScheduler.domain, taskScheduler.findUnevaluatedTasksLimit);
                    expect(taskScheduler.evaluateTaskStream.onNext).to.have.been.calledThrice;
                    expect(taskScheduler.evaluateTaskStream.onNext)
                        .to.have.been.calledWith(tasks[0]);
                    expect(taskScheduler.evaluateTaskStream.onNext)
                        .to.have.been.calledWith(tasks[1]);
                    expect(taskScheduler.evaluateTaskStream.onNext)
                        .to.have.been.calledWith(tasks[2]);
                });
            });

            it('should handle stream errors', function(done) {
                var testError = new Error('test');
                store.findUnevaluatedTasks.onFirstCall().rejects(testError);
                store.findUnevaluatedTasks.resolves([{ taskId: 'taskid1' }]);

                observable = observable.take(1);

                streamCompletedWrapper(observable, done, function() {
                    expect(taskScheduler.handleStreamError).to.have.been.calledWith(
                        'Error finding unevaluated tasks',
                        testError
                    );
                    expect(taskScheduler.evaluateTaskStream.onNext).to.have.been.calledOnce;
                });
            });
        });

        describe('createTasksToScheduleSubscription', function() {
            var observable;

            beforeEach(function() {
                this.sandbox.stub(store, 'findReadyTasks');

                taskScheduler = TaskScheduler.create();
                taskScheduler.running = true;

                this.sandbox.stub(taskScheduler, 'findReadyTasks');
                this.sandbox.stub(taskScheduler, 'handleScheduleTaskEvent');
                this.sandbox.stub(taskScheduler, 'publishScheduleTaskEvent');
            });

            it('should not flow if scheduler is not running', function(done) {
                store.findReadyTasks.resolves({});
                taskScheduler.subscriptions = [];
                var evaluateGraphStream = new Rx.Subject();
                observable = taskScheduler.createTasksToScheduleSubscription(evaluateGraphStream);

                return taskScheduler.stop()
                .then(function() {
                    streamCompletedWrapper(observable, done, function() {
                        expect(store.findReadyTasks).to.not.have.been.called;
                    });
                    evaluateGraphStream.onNext();
                });
            });

            it('should filter if no tasks are found', function(done) {
                taskScheduler.findReadyTasks.resolves([]);
                taskScheduler.handleScheduleTaskEvent.resolves({});
                observable = taskScheduler.createTasksToScheduleSubscription(
                    Rx.Observable.just());

                streamCompletedWrapper(observable, done, function() {
                    expect(taskScheduler.handleScheduleTaskEvent).to.not.have.been.called;
                });
            });

            it('should schedule ready tasks for a graph', function(done) {
                var task = {
                    domain: taskScheduler.domain,
                    graphId: 'testgraphid',
                    taskId: 'testtaskid'
                };
                var result = {
                    tasks: [task, task, task]
                };
                taskScheduler.findReadyTasks.restore();
                store.findReadyTasks.resolves(result);
                taskScheduler.handleScheduleTaskEvent.resolves({});
                observable = taskScheduler.createTasksToScheduleSubscription(
                    Rx.Observable.just({ graphId: 'testgraphid' }));

                streamCompletedWrapper(observable, done, function() {
                    expect(store.findReadyTasks).to.have.been.calledOnce;
                    expect(store.findReadyTasks).to.have.been.calledWith(
                        taskScheduler.domain, 'testgraphid');
                    expect(taskScheduler.handleScheduleTaskEvent).to.have.been.calledThrice;
                    expect(taskScheduler.handleScheduleTaskEvent).to.have.been.calledWith(task);
                });
            });

            it('should handle handleScheduleTaskEvent errors', function(done) {
                var testError = new Error('test handleScheduleTaskEvent error');
                taskScheduler.findReadyTasks.resolves({ tasks: [{}] });
                taskScheduler.handleScheduleTaskEvent.restore();
                taskScheduler.publishScheduleTaskEvent.onFirstCall().rejects(testError);
                taskScheduler.publishScheduleTaskEvent.resolves();
                observable = taskScheduler.createTasksToScheduleSubscription(
                                Rx.Observable.from([null, null]))
                                .take(2);

                streamCompletedWrapper(observable, done, function() {
                    expect(taskScheduler.handleStreamError).to.have.been.calledWith(
                        'Error scheduling task',
                        testError
                    );
                });
            });

            it('should handle findReadyTasks errors', function(done) {
                var testError = new Error('test findReadyTasks error');
                taskScheduler.findReadyTasks.restore();
                store.findReadyTasks.onFirstCall().rejects(testError);
                store.findReadyTasks.resolves({ tasks: [{}] });
                taskScheduler.handleScheduleTaskEvent.resolves();
                observable = taskScheduler.createTasksToScheduleSubscription(
                                Rx.Observable.from([ {}, {} ]))
                                .take(2);

                streamCompletedWrapper(observable, done, function() {
                    expect(taskScheduler.handleStreamError).to.have.been.calledWith(
                        'Error finding ready tasks',
                        testError
                    );
                    expect(taskScheduler.handleScheduleTaskEvent).to.have.been.calledOnce;
                });
            });
        });
    });

    describe('createUpdateTaskDependenciesSubscription', function() {
        var taskScheduler;
        var taskHandlerStream;
        var observable;
        var checkGraphFinishedStream;
        var evaluateGraphStream;

        beforeEach(function() {
            this.sandbox.stub(store, 'setTaskStateInGraph').resolves();
            this.sandbox.stub(store, 'updateDependentTasks').resolves();
            this.sandbox.stub(store, 'updateUnreachableTasks').resolves();
            this.sandbox.stub(store, 'markTaskEvaluated');

            taskHandlerStream = new Rx.Subject();
            evaluateGraphStream = new Rx.Subject();
            checkGraphFinishedStream = new Rx.Subject();
            this.sandbox.spy(evaluateGraphStream, 'onNext');
            this.sandbox.spy(checkGraphFinishedStream, 'onNext');

            taskScheduler = TaskScheduler.create();
            taskScheduler.running = true;

            observable = taskScheduler.createUpdateTaskDependenciesSubscription(
                taskHandlerStream,
                evaluateGraphStream,
                checkGraphFinishedStream
            );
        });

        afterEach(function() {
            taskHandlerStream.dispose();
            evaluateGraphStream.dispose();
            checkGraphFinishedStream.dispose();
        });

        it('should not flow if scheduler is not running', function(done) {
            this.sandbox.stub(taskScheduler, 'updateTaskDependencies');
            taskScheduler.subscriptions = [];

            return taskScheduler.stop()
            .then(function() {
                streamCompletedWrapper(observable, done, function() {
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

            streamSuccessWrapper(observable, done, function() {
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

            streamSuccessWrapper(observable, done, function() {
                expect(evaluateGraphStream.onNext).to.have.been.calledOnce;
                expect(evaluateGraphStream.onNext).to.have.been.calledWith({
                    graphId: 'testgraphid'
                });
            });

            taskHandlerStream.onNext({});
        });

        it('should handle errors related to updating task dependencies', function(done) {
            var testError = new Error('test update dependencies error');
            store.setTaskStateInGraph.onFirstCall().rejects(testError);
            store.setTaskStateInGraph.resolves({});
            store.markTaskEvaluated.resolves({});
            this.sandbox.stub(taskScheduler, 'handleEvaluatedTask');

            observable = taskScheduler.createUpdateTaskDependenciesSubscription(
                Rx.Observable.from([{}, {}]),
                evaluateGraphStream,
                checkGraphFinishedStream
            ).take(2);

            streamCompletedWrapper(observable, done, function() {
                expect(taskScheduler.handleStreamError).to.have.been.calledOnce;
                expect(taskScheduler.handleStreamError).to.have.been.calledWith(
                    'Error updating task dependencies',
                    testError);
                expect(taskScheduler.handleEvaluatedTask).to.have.been.calledOnce;
            });
        });
    });

    describe('createCheckGraphFinishedSubscription', function() {
        var taskScheduler;
        var checkGraphFinishedStream;
        var observable;

        beforeEach(function() {
            checkGraphFinishedStream = new Rx.Subject();
            taskScheduler = TaskScheduler.create();
            taskScheduler.running = true;
            this.sandbox.stub(taskScheduler, 'checkGraphSucceeded');
            this.sandbox.stub(taskScheduler, 'failGraph');
        });

        it('should not flow if scheduler is not running', function(done) {
            taskScheduler.subscriptions = [];
            observable = taskScheduler.createCheckGraphFinishedSubscription(
                checkGraphFinishedStream);

            return taskScheduler.stop()
            .then(function() {
                streamCompletedWrapper(observable, done, function() {
                    expect(taskScheduler.checkGraphSucceeded).to.not.have.been.called;
                    expect(taskScheduler.failGraph).to.not.have.been.called;
                });
                checkGraphFinishedStream.onNext({});
            });
        });

        afterEach(function() {
            checkGraphFinishedStream.dispose();
        });

        it('should check if a graph is succeeded on a succeeded task state', function(done) {
            var data = {
                taskId: 'testtaskid',
                state: Constants.Task.States.Failed
            };
            taskScheduler.failGraph.resolves();
            observable = taskScheduler.createCheckGraphFinishedSubscription(
                checkGraphFinishedStream);

            streamSuccessWrapper(observable, done, function() {
                expect(taskScheduler.failGraph).to.have.been.calledOnce;
                expect(taskScheduler.failGraph).to.have.been.calledWith(data);
            });

            checkGraphFinishedStream.onNext(data);
        });

        it('should fail a graph on a terminal, failed task state', function(done) {
            var data = {
                taskId: 'testtaskid',
                state: Constants.Task.States.Succeeded
            };
            taskScheduler.checkGraphSucceeded.resolves();
            observable = taskScheduler.createCheckGraphFinishedSubscription(
                checkGraphFinishedStream);

            streamSuccessWrapper(observable, done, function() {
                expect(taskScheduler.checkGraphSucceeded).to.have.been.calledOnce;
                expect(taskScheduler.checkGraphSucceeded).to.have.been.calledWith(data);
            });

            checkGraphFinishedStream.onNext(data);
        });

        it('it should should not fail a graph based on an ignored failure', function(done) {
            var data = {
                taskId: 'testtaskid',
                state: Constants.Task.States.Failed,
                ignoreFailure: true
            };
            taskScheduler.checkGraphSucceeded.resolves();
            observable = taskScheduler.createCheckGraphFinishedSubscription(
                checkGraphFinishedStream);

            streamSuccessWrapper(observable, done, function() {
                expect(taskScheduler.failGraph).to.not.have.been.called;
            });

            checkGraphFinishedStream.onNext(data);
        });


        it('should handle failGraph errors', function(done) {
            var data = {
                taskId: 'testtaskid',
                state: Constants.Task.States.Failed,
                graphId: 'testgraphid'
            };
            var testError = new Error('test fail graph error');
            this.sandbox.stub(store, 'getActiveGraphById').rejects(testError);
            taskScheduler.failGraph.restore();
            observable = taskScheduler.createCheckGraphFinishedSubscription(
                Rx.Observable.just(data));

            streamCompletedWrapper(observable, done, function() {
                expect(taskScheduler.handleStreamError).to.have.been.calledOnce;
                expect(taskScheduler.handleStreamError).to.have.been.calledWith(
                    'Error failing/cancelling graph',
                    testError
                );
            });
        });

        it('checkGraphSucceeded should persist and publish on finish', function(done) {
            this.sandbox.stub(taskScheduler, 'publishGraphFinished');
            this.sandbox.stub(store, 'setGraphDone');
            this.sandbox.stub(store, 'checkGraphSucceeded');
            taskScheduler.checkGraphSucceeded.restore();
            var data = { graphId: 'testgraphid' };
            var graphData = {
                instanceId: 'testid',
                _status: Constants.Task.States.Succeeded,
                ignoreThisField: 'please'
            };
            var dataDone = { graphId: 'testgraphid', done: true };
            store.checkGraphSucceeded.resolves(dataDone);
            store.setGraphDone.resolves(graphData);

            var observable = taskScheduler.checkGraphSucceeded(data);
            streamSuccessWrapper(observable, done, function() {
                expect(store.checkGraphSucceeded).to.have.been.calledOnce;
                expect(store.checkGraphSucceeded).to.have.been.calledWith(data);
                expect(store.setGraphDone).to.have.been.calledOnce;
                expect(store.setGraphDone).to.have.been.calledWith(
                    Constants.Task.States.Succeeded,
                    dataDone
                );
                expect(taskScheduler.publishGraphFinished).to.have.been.calledOnce;
                expect(taskScheduler.publishGraphFinished).to.have.been.calledWith({
                    instanceId: 'testid',
                    _status: Constants.Task.States.Succeeded
                });
            });
        });

        it('checkGraphSucceeded should not set a graph as done if it is not', function(done) {
            this.sandbox.stub(taskScheduler, 'publishGraphFinished');
            this.sandbox.stub(store, 'setGraphDone');
            this.sandbox.stub(store, 'checkGraphSucceeded');
            taskScheduler.checkGraphSucceeded.restore();
            var data = { graphId: 'testgraphid' };
            var graphData = {
                instanceId: 'testid',
                _status: Constants.Task.States.Succeeded,
                ignoreThisField: 'please'
            };
            var dataDone = { graphId: 'testgraphid', done: false };
            store.checkGraphSucceeded.resolves(dataDone);
            store.setGraphDone.resolves(graphData);

            var observable = taskScheduler.checkGraphSucceeded(data);
            streamCompletedWrapper(observable, done, function() {
                expect(store.checkGraphSucceeded).to.have.been.calledOnce;
                expect(store.setGraphDone).to.not.have.been.called;
                expect(taskScheduler.publishGraphFinished).to.not.have.been.called;
            });
        });
    });
});
