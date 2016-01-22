// Copyright 2015, EMC, Inc.
/* jshint node:true */

'use strict';

describe("Task-runner", function() {
    var runner,
    Task = {},
    TaskRunner,
    taskMessenger = {},
    store = {
        checkoutTask: function(){},
        getTaskById: function(){},
        heartbeatTasksForRunner: function(){}
    },
    Promise,
    Rx;

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

    var streamOnCompletedWrapper = function(stream, done, cb) {
            stream.subscribe(
                    function(){},
                    function(){},
                    asyncAssertWrapper(done, cb)
            );
    };

    var setImmediateAssertWrapper = function(done, cb) {
        setImmediate(asyncAssertWrapper(done, cb));
    };

    before(function() {
        helper.setupInjector([
                require('../../lib/task-runner.js'),
                helper.di.simpleWrapper(taskMessenger, 'Task.Messenger'),
                helper.di.simpleWrapper(Task, 'Task.Task'),
                helper.di.simpleWrapper(store, 'TaskGraph.Store')
        ]);
        Rx = helper.injector.get('Rx');
        Promise = helper.injector.get('Promise');
        TaskRunner = helper.injector.get('TaskGraph.TaskRunner');
        this.sandbox = sinon.sandbox.create();
    });


    afterEach(function() {
        this.sandbox.restore();
    });


    describe('start', function() {

        beforeEach(function() {
            runner = TaskRunner.create();
            this.sandbox.stub(runner, 'subscribeCancel').resolves();
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

        it('should return disposable subscriptions', function() {
            this.sandbox.stub(store, 'checkoutTask');
            this.sandbox.stub(store, 'getTaskById');
            runner.initializePipeline().forEach(function(subscription) {
                expect(subscription).to.have.property('dispose')
                .that.is.a('function');
            });
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
            store.checkoutTask.onCall(1).throws(new Error('checkout error'));
            store.getTaskById.onCall(0).throws(new Error('get task error'));
            runner.runTask = this.sandbox.stub().resolves();
            var eSpy = sinon.spy(runner, 'handleStreamError');
            runner.handleStreamSuccess = this.sandbox.stub();

            var taskStream = runner.createRunTaskSubscription(
                    Rx.Observable.from([
                            taskAndGraphId,
                            taskAndGraphId,
                            taskAndGraphId
                        ]));

            streamOnCompletedWrapper(taskStream, done, function() {
                expect(eSpy.callCount).to.equal(2);
                expect(runner.runTask).to.be.calledOnce;
            });
        });
    });

    describe('createHeartbeatSubscription', function() {

        beforeEach(function() {
            this.sandbox.restore();
            runner = TaskRunner.create();
            this.sandbox.stub(store, 'heartbeatTasksForRunner').resolves();
            this.sandbox.stub(runner, 'handleLostTasks').resolves();
            this.sandbox.stub(runner, 'handleUnownedTasks').resolves();
            runner.handleStreamSuccess = this.sandbox.stub();
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
            runner.stop = this.sandbox.stub();
            var heartStream = runner.createHeartbeatSubscription(Rx.Observable.interval(1));
            streamOnCompletedWrapper(heartStream, done, function() {
                expect(store.heartbeatTasksForRunner).to.have.been.calledOnce;
                expect(runner.stop).to.have.been.calledOnce;
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
            runner.stop();
            expect(runner.isRunning()).to.equal(false);
        });

        it('should dispose all pipelines', function() {
            var mockOne = { dispose: sinon.stub() },
            mockTwo = { dispose: sinon.stub() };
            runner.pipelines = [
                mockOne,
                mockTwo
            ];
            runner.stop();
            expect(runner.pipelines.length).to.equal(0);
            expect(mockOne.dispose).to.have.been.calledOnce;
            expect(mockTwo.dispose).to.have.been.calledOnce;
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
                taskId: 'aTaskId',
                context: { graphId: 'aGraphId'},
                state: 'finished'
            };
            runner.publishTaskFinished(finishedTask)
            .then(function() {
                expect(taskMessenger.publishTaskFinished).to.have.been.calledOnce;
            });
        });
    });

    describe('stream handlers', function() {

        beforeEach(function() {
            this.sandbox.restore();
            runner = TaskRunner.create();
        });

        it('stream success handler should return an observable', function() {
            expect(runner.handleStreamSuccess()).to.be.an.instanceof(Rx.Observable);
        });

        it('stream error handler should return an empty observable', function() {
            expect(runner.handleStreamError('test', {})).to.be.an.instanceof(Rx.Observable);
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
                state: 'finished'
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
            stubbedTask = _.defaults({run: this.sandbox.stub()}, taskDef);
            Task.create = this.sandbox.stub().returns(stubbedTask);
            stubbedTask.definition = { injectableName: 'taskName'};
            stubbedTask.run = this.sandbox.stub().resolves(finishedTask);
            store.setTaskState = this.sandbox.stub().resolves();
            runner.publishTaskFinished = this.sandbox.stub();
        });

        it('should return an Observable', function() {
            expect(runner.runTask(data)).to.be.an.instanceof(Rx.Observable);
        });

        it('should instantiate a task', function() {
            runner.runTask(data).subscribe(function() {
                expect(Task.create).to.have.been.calledOnce;
            });
        });

        it('should call a task\'s run method', function() {
            runner.runTask(data).subscribe(function() {
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

        it('should publish a task finished event', function() {
            runner.runTask(data).subscribe(function() {
                expect(runner.publishTaskFinished).to.have.been.calledOnce;
            });
        });

        it('should set the state of a task', function() {
            runner.runTask(data).subscribe(function() {
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
