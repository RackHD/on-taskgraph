// Copyright 2016, EMC, Inc.

'use strict';

describe("Task Runner", function() {
    var di = require('di');
    var core = require('on-core')(di, __dirname);

    var runner,
    Task = {
        create: function() {}
    },
    TaskRunner,
    taskMessenger = {},
    store = {
        checkoutTask: function(){},
        getTaskById: function(){},
        getOwnTasks: function(){},
        expireLease: function(){},
        heartbeatTasksForRunner: function(){}
    },
    Promise,
    Constants,
    assert,
    Rx;

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

    var streamOnCompletedWrapper = function(stream, done, cb) {
            stream.subscribe(
                    function(){},
                    function(err){done(err);},
                    asyncAssertWrapper(done, cb)
            );
    };

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

    before(function() {
        helper.setupInjector([
            core.workflowInjectables,
            require('../../lib/task-runner.js'),
            helper.di.simpleWrapper(taskMessenger, 'Task.Messengers.AMQP'),
            helper.di.simpleWrapper(Task, 'Task.Task'),
            helper.di.simpleWrapper(store, 'TaskGraph.Store')
        ]);
        Rx = helper.injector.get('Rx');
        Promise = helper.injector.get('Promise');
        Constants = helper.injector.get('Constants');
        assert = helper.injector.get('Assert');
        TaskRunner = helper.injector.get('TaskGraph.TaskRunner');
        this.sandbox = sinon.sandbox.create();
    });

    beforeEach(function() {
        runner = TaskRunner.create();
    });

    afterEach(function() {
        this.sandbox.restore();
    });

    describe('start', function() {

        beforeEach(function() {
            runner = TaskRunner.create();
            this.sandbox.stub(runner, 'subscribeCancelTask').resolves();
            this.sandbox.stub(runner, 'subscribeRunTask').resolves();
            this.sandbox.stub(runner, 'initializePipeline');
            runner.running = false;
        });

        afterEach(function() {
            this.sandbox.restore();
        });

        it('should mark itself running', function(done) {
            return runner.start()
            .then(asyncAssertWrapper(done, function() {
                expect(runner.isRunning()).to.equal(true);
            }));
        });

        it('should initialize its pipelines', function(done) {
            this.sandbox.stub(store, 'heartbeatTasksForRunner');
            return runner.start()
            .then(asyncAssertWrapper(done, function() {
                expect(runner.initializePipeline).to.have.been.calledOnce;
            }));
        });

        it('should subscribe to a task messenger', function(done) {
            return runner.start()
            .then(asyncAssertWrapper(done, function() {
                expect(runner.subscribeRunTask).to.have.been.calledOnce;
            }));
        });
    });

    describe('initializePipeline', function() {
        it('should create and subscribe to all of it\'s pipelines', function() {
            runner = TaskRunner.create();
            var runStub = {subscribe: this.sandbox.stub()};
            var heartStub = {subscribe: this.sandbox.stub()};
            var cancelStub = {subscribe: this.sandbox.stub()};

            this.sandbox.stub(runner, 'createRunTaskSubscription').returns(runStub);
            this.sandbox.stub(runner, 'createHeartbeatSubscription').returns(heartStub);
            this.sandbox.stub(runner, 'createCancelTaskSubscription').returns(cancelStub);

            runner.initializePipeline();
            expect(runner.createRunTaskSubscription).to.have.been.calledOnce;
            expect(runStub.subscribe).to.have.been.calledOnce;
            expect(runner.createHeartbeatSubscription).to.have.been.calledOnce;
            expect(heartStub.subscribe).to.have.been.calledOnce;
            expect(runner.createCancelTaskSubscription).to.have.been.calledOnce;
            expect(cancelStub.subscribe).to.have.been.calledOnce;
        });
    });

    describe('createRunTaskSubscription', function() {
        var taskAndGraphId,
            taskData,
            taskStatus;

        beforeEach(function() {
            runner = TaskRunner.create();
            taskAndGraphId = {
                taskId: 'someTaskId',
                graphId: 'someGraphId'
            };
            taskData = {
                instanceId: 'someTaskId',
                runJob: 'someJob',
                name: 'taskName'
            };
            taskStatus = {
                instanceId: 'someTaskId',
                state: 'someFinishedState'
            };
            this.sandbox.stub(store, 'checkoutTask').resolves(taskAndGraphId);
            this.sandbox.stub(store, 'getTaskById').resolves(taskData);
            this.sandbox.stub(runner, 'runTask').resolves(taskStatus);
        });

        afterEach(function() {
            this.sandbox.restore();
        });

        it('should not flow if task runner is not running', function(done) {
            runner.running = false;

            var taskStream = runner.createRunTaskSubscription(Rx.Observable.just(taskAndGraphId));

            streamOnCompletedWrapper(taskStream, done, function() {
                expect(store.checkoutTask).to.not.have.been.called;
            });
        });

        it('should return an Observable', function() {
            runner.running = true;
            var taskStream = runner.createRunTaskSubscription(runner.runTaskStream);
            expect(taskStream).to.be.an.instanceof(Rx.Observable);
        });

        it('should filter tasks which were not checked out', function(done) {
            runner.running = true;
            var taskStream = runner.createRunTaskSubscription(Rx.Observable.just(taskAndGraphId));
            store.checkoutTask.resolves(undefined);

            streamOnCompletedWrapper(taskStream, done, function() {
                expect(store.checkoutTask).to.have.been.calledOnce;
                expect(store.getTaskById).to.not.have.been.called;
            });
        });

        it('should run a task', function(done) {
            runner.running = true;
            this.sandbox.stub(runner, 'handleStreamSuccess');
            var taskStream = runner.createRunTaskSubscription(Rx.Observable.just(taskAndGraphId));

            streamOnCompletedWrapper(taskStream, done, function() {
                expect(runner.runTask).to.have.been.calledOnce;
            });
        });

        it('should handle stream errors without crashing the main stream', function(done) {
            runner.running = true;
            var streamOnCompleteWrapper = function(stream, done, cb) {
                stream.subscribe(
                        runner.handleStreamSuccess.bind(runner, 'success'),
                        function(err){done(err);},
                        asyncAssertWrapper(done, cb)
                );
            };
            store.checkoutTask.onCall(1).throws(new Error('checkout error'));
            store.getTaskById.onCall(0).throws(new Error('get task error'));
            runner.runTask = this.sandbox.stub().resolves({});
            var eSpy = sinon.spy(runner, 'handleStreamError');
            var sSpy = sinon.spy(runner, 'handleStreamSuccess');

            var taskStream = runner.createRunTaskSubscription(
                    Rx.Observable.from([
                            taskAndGraphId,
                            taskAndGraphId,
                            taskAndGraphId
                        ]));

            streamOnCompleteWrapper(taskStream, done, function() {
                expect(eSpy.callCount).to.equal(2);
                expect(sSpy).to.be.calledOnce;
                expect(runner.runTask).to.be.calledOnce;
            });
        });
    });

    describe('createHeartbeatSubscription', function() {

        beforeEach(function() {
            this.sandbox.restore();
            runner = TaskRunner.create();
            this.sandbox.stub(store, 'heartbeatTasksForRunner').resolves();
            this.sandbox.stub(store, 'getOwnTasks').resolves();
            this.sandbox.stub(runner, 'handleLostTasks').resolves();
            this.sandbox.stub(runner, 'handleUnownedTasks').resolves();
        });

        afterEach(function() {
            this.sandbox.restore();
        });

        it('should heartbeat Tasks on an interval', function(done) {
            runner.running = true;
            runner.heartbeat = Rx.Observable.interval(1);
            var heartStream = runner.createHeartbeatSubscription(runner.heartbeat).take(5);
            streamOnCompletedWrapper(heartStream, done, function() {
                expect(store.heartbeatTasksForRunner.callCount).to.equal(5);
            });
        });

        it('should not beat when the runner is not running', function(done) {
            runner.running = false;
            var heartStream = runner.createHeartbeatSubscription(Rx.Observable.interval(1)).take(5);

            streamOnCompletedWrapper(heartStream, done, function() {
                expect(store.heartbeatTasksForRunner).to.not.have.been.called;
            });
        });

        it('should return an Observable', function() {
            var heartStream = runner.createHeartbeatSubscription(Rx.Observable.interval(1));
            expect(heartStream).to.be.an.instanceof(Rx.Observable);
        });

        it('should stop the runner on Error', function(done) {
            runner.running = true;
            runner.heartbeatInterval = 1;
            store.heartbeatTasksForRunner = this.sandbox.stub().throws(new Error('test error'));
            runner.stop = this.sandbox.stub().resolves();
            var heartStream = runner.createHeartbeatSubscription(Rx.Observable.interval(1));
            streamOnCompletedWrapper(heartStream, done, function() {
                expect(store.heartbeatTasksForRunner).to.have.been.calledOnce;
                expect(runner.stop).to.have.been.calledOnce;
            });
        });

        it('should stop unowned tasks', function(done) {
            runner.running = true;
            var stopStub = this.sandbox.stub();
            runner.activeTasks.excessTask1 = {
                taskId: 'excessTask1',
                stop: stopStub
            };

            runner.activeTasks.excessTask2 = {
                taskId: 'excessTask2',
                stop: stopStub
            };

            runner.handleUnownedTasks.restore();
            store.getOwnTasks.resolves(undefined);
            store.heartbeatTasksForRunner.resolves(1);
            var heartStream = runner.createHeartbeatSubscription(Rx.Observable.interval(1)).take(3);

            streamOnCompletedWrapper(heartStream, done, function() {
                expect(stopStub).to.have.been.calledTwice;
                expect(runner.activeTasks).to.be.empty;
            });
        });

        it('should expire lost tasks', function(done) {
            runner.running = true;
            var excessTask1 = {
                taskId: 'excessTask1'
            };

            var excessTask2 = {
                taskId: 'excessTask2'
            };

            runner.handleLostTasks.restore();
            this.sandbox.stub(store, 'expireLease').resolves();
            store.getOwnTasks.resolves([excessTask1, excessTask2]);
            store.heartbeatTasksForRunner.resolves(1);
            var heartStream = runner.createHeartbeatSubscription(Rx.Observable.interval(1)).take(3);

            streamOnCompletedWrapper(heartStream, done, function() {
                expect(store.expireLease).to.have.been.calledWith('excessTask1');
                expect(store.expireLease).to.have.been.calledWith('excessTask2');
                expect(runner.lostTasks).to.be.empty;
            });
        });
    });

    describe('stop', function() {

        beforeEach(function() {
            this.sandbox.restore();
            runner = TaskRunner.create();
        });

        it('should mark itself not running', function() {
            runner.running = true;
            return runner.stop()
            .then(function() {
                expect(runner.isRunning()).to.equal(false);
            });
        });

        it('should dispose all pipelines', function() {
            var sub1 = { dispose: sinon.stub() };
            var sub2 = { dispose: sinon.stub() };
            runner.subscriptions = [sub1, sub2];

            return runner.stop()
            .then(function() {
                expect(runner.subscriptions.length).to.equal(0);
                expect(sub1.dispose).to.have.been.calledOnce;
                expect(sub2.dispose).to.have.been.calledOnce;
            });
        });
    });


    describe('subscribeRunTask', function() {

        before(function() {
            this.sandbox.restore();
            runner = TaskRunner.create();
        });

        it("should wrap the taskMessenger's subscribeRunTask method", function() {
            taskMessenger.subscribeRunTask = this.sandbox.stub();
            runner.subscribeRunTask();
            expect(taskMessenger.subscribeRunTask).to.have.been.calledOnce;
        });
    });

    describe('publishTaskFinished', function() {
        before(function() {
            this.sandbox.restore();
            runner = TaskRunner.create();
        });

        it("should wrap the taskMessenger's publishTaskFinished", function() {
            taskMessenger.publishTaskFinished = this.sandbox.stub().resolves();
            var finishedTask = {
                instanceId: 'aTaskId',
                context: { graphId: 'aGraphId'},
                state: 'finished',
                definition: { terminalOnStates: ['succeeded'] }
            };

            return runner.publishTaskFinished(finishedTask)
            .then(function() {
                expect(taskMessenger.publishTaskFinished).to.have.been.calledOnce;
                expect(taskMessenger.publishTaskFinished).to.have.been.calledWith(
                    runner.domain,
                    finishedTask.instanceId,
                    finishedTask.context.graphId,
                    finishedTask.state,
                    undefined,
                    finishedTask.context,
                    finishedTask.definition.terminalOnStates
                );
            });
        });

        it("should call publishTaskFinished with an error message string", function() {
            taskMessenger.publishTaskFinished = this.sandbox.stub().resolves();
            var error = new Error('test error');
            var finishedTask = {
                taskId: 'aTaskId',
                context: { graphId: 'aGraphId'},
                state: 'finished',
                error: error,
                definition: { terminalOnStates: ['succeeded'] }
            };

            return runner.publishTaskFinished(finishedTask)
            .then(function() {
                expect(taskMessenger.publishTaskFinished).to.have.been.calledOnce;
                expect(taskMessenger.publishTaskFinished.firstCall.args[4])
                    .to.contain('test error');
            });
        });

        it("should call publishTaskFinished with an Rx error stack string", function() {
            taskMessenger.publishTaskFinished = this.sandbox.stub().resolves();
            var error = new Error('test error');
            error.stack = error.toString();
            var finishedTask = {
                taskId: 'aTaskId',
                context: { graphId: 'aGraphId'},
                state: 'finished',
                error: error,
                definition: { terminalOnStates: ['succeeded'] }
            };

            return runner.publishTaskFinished(finishedTask)
            .then(function() {
                expect(taskMessenger.publishTaskFinished).to.have.been.calledOnce;
                expect(taskMessenger.publishTaskFinished.firstCall.args[4]).to.equal(error.stack);
            });
        });
    });

    describe('task cancellation', function() {

        beforeEach(function() {
            this.sandbox.restore();
            runner = TaskRunner.create();
        });

        it("should wrap the taskMessenger's subscribeCancel method", function() {
            taskMessenger.subscribeCancelTask = this.sandbox.stub();
            runner.subscribeCancelTask();
            expect(taskMessenger.subscribeCancelTask).to.have.been.calledOnce;
        });

        it('should cancel tasks fed through the cancelTask stream', function(done) {
            runner.running = true;
            var cancelStub = this.sandbox.stub().resolves();

            runner.activeTasks.testTaskId = {
                cancel: cancelStub,
                toJSON: this.sandbox.stub()
            };
            var cancelStream = runner.createCancelTaskSubscription(
                    Rx.Observable.just({taskId: 'testTaskId'}));

            streamOnCompletedWrapper(cancelStream, done, function() {
                expect(cancelStub).to.have.been.calledOnce;
            });

        });
    });

    describe('runTask', function() {
        var finishedTask, data, taskDef, stubbedTask;

        before(function() {
            taskDef = {
                instanceId: 'anInstanceId',
                friendlyName: 'testTask',
                implementsTask: 'fakeBaseTask',
                runJob: 'fakeJob',
                options: {},
                properties: {}
            };
            finishedTask = {
                taskId: 'aTaskId',
                instanceId: 'anInstanceId',
                context: { graphId: 'aGraphId'},
                state: 'finished',
                definition: { terminalOnStates: ['succeeded'] }
            };
            data = {
                task: taskDef,
                context: {}
            };
        });

        beforeEach(function() {
            this.sandbox.restore();
            runner = TaskRunner.create();
            stubbedTask = {};
            stubbedTask = _.defaults({run: this.sandbox.stub().resolves(finishedTask)}, taskDef);
            stubbedTask.definition = { injectableName: 'taskName'};
            this.sandbox.stub(Task, 'create').resolves(stubbedTask);
            store.setTaskState = this.sandbox.stub().resolves();
            this.sandbox.stub(runner, 'publishTaskFinished');
        });

        it('should return an Observable', function() {
            expect(runner.runTask(data)).to.be.an.instanceof(Rx.Observable);
        });

        it('should instantiate a task', function(done) {
            streamOnCompletedWrapper(runner.runTask(data), done, function() {
                expect(Task.create).to.have.been.calledOnce;
            });
        });

        it('should call a task\'s run method', function(done) {
            streamOnCompletedWrapper(runner.runTask(data), done, function() {
                expect(stubbedTask.run).to.have.been.calledOnce;
            });
        });

        it('should add and remove tasks from its activeTasks list', function(done) {
            stubbedTask.run = function() {
                expect(runner.activeTasks[taskDef.instanceId]).to.equal(stubbedTask);
                return Promise.resolve(finishedTask);
            };

            streamOnCompletedWrapper(runner.runTask(data), done, function() {
                expect(_.isEmpty(runner.activeTasks)).to.equal(true);
            });
        });

        it('should publish a task finished event', function(done) {
            streamOnCompletedWrapper(runner.runTask(data), done, function() {
                expect(runner.publishTaskFinished).to.have.been.calledOnce;
            });
        });

        it('should set the state of a task', function(done) {
            streamOnCompletedWrapper(runner.runTask(data), done, function() {
                expect(store.setTaskState).to.have.been.calledOnce;
            });
        });

        it('should not crash the parent stream if a task fails', function(done) {
            runner.running = true;
            var taskAndGraphId = {taskJunk: 'junk'};
            stubbedTask.run.onCall(0).throws(new Error('test error'));
            stubbedTask.run.resolves(finishedTask);
            this.sandbox.stub(runner, 'handleStreamError').resolves();
            store.checkoutTask = this.sandbox.stub().resolves({ task: 'taskStuff'});
            store.getTaskById = this.sandbox.stub().resolves(data);
            var taskStream = runner.createRunTaskSubscription(
                    Rx.Observable.from([
                        taskAndGraphId,
                        taskAndGraphId
                    ]));


            streamOnCompletedWrapper(taskStream, done, function() {
                expect(runner.handleStreamError).to.be.called.once;
                expect(runner.publishTaskFinished).to.have.been.calledOnce;
            });
        });
    });
});
