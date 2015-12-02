// Copyright 2015, EMC, Inc.
/* jshint node:true */

'use strict';

describe("Task-runner", function() {
    var runner,
    Task = {},
    TaskRunner,
    taskMessenger = {},
    store = {},
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

    var setImmediateAssertWrapper = function(done, cb) {
        setImmediate(asyncAssertWrapper(done, cb));
    };

    before(function() {
        helper.setupInjector([
                require('../../lib/task-runner.js'),
                require('../../lib/messenger.js'),
                require('../../lib/messengers/messenger-AMQP.js'),
                helper.di.simpleWrapper(taskMessenger, 'Task.Messenger.AMQP'),
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

    describe('stream setup/cleanup', function() {

        describe('start', function() {

            beforeEach(function() {
                this.sandbox.restore();
                runner = TaskRunner.create();
            });

            it('should mark itself running', function(done) {
                runner.running = false;
                runner.subscribeRunTask = this.sandbox.stub();
                runner.initializePipeline = this.sandbox.stub();
                return runner.start()
                .then(function() {
                    try {
                        expect(runner.isRunning()).to.equal(true);
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });

            it('should initialize its pipelines', function(done) {
                runner.running = false;
                runner.subscribeRunTask = this.sandbox.stub();
                runner.initializePipeline = this.sandbox.stub();
                store.heartbeatTasksForRunner = this.sandbox.stub();
                return runner.start()
                .then(function() {
                    try {
                        expect(runner.initializePipeline).to.have.been.calledOnce;
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });

            it('should subscribe to a task messenger', function(done) {
                runner.running = false;
                runner.subscribeRunTask = this.sandbox.stub();
                runner.initializePipeline = this.sandbox.stub();
                return runner.start()
                .then(function() {
                    try {
                        expect(runner.subscribeRunTask).to.have.been.calledOnce;
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });

            describe('initializePipeline', function() {

                it('should return disposable subscriptions', function() {
                    store.checkoutTask = this.sandbox.stub();
                    store.getTaskById = this.sandbox.stub();
                    runner.initializePipeline().forEach(function(subscription) {
                        expect(subscription).to.have.property('dispose')
                        .that.is.a('function');
                    });
                });


                describe('createRunTaskSubscription', function() {
                    var taskAndGraphId;

                    beforeEach(function() {
                        this.sandbox.restore();
                        runner = TaskRunner.create();
                        store.checkoutTask = this.sandbox.stub().resolves();
                        store.getTaskById = this.sandbox.stub().resolves();
                        taskAndGraphId = {
                            taskId: 'someTaskId',
                            graphId: 'someGraphId'
                        };
                    });

                    it('should not flow if task runner is not running', function(done) {
                        runner.running = false;
                        var subscription = runner.createRunTaskSubscription(runner.runTaskStream);
                        runner.runTaskStream.onNext(taskAndGraphId);
                        setImmediateAssertWrapper(done, function() {
                            expect(store.checkoutTask).to.not.have.been.called;
                            subscription.dispose();
                        });
                    });

                    it('should return a disposable subscription', function() {
                        runner.running = true;
                        var subscription = runner.createRunTaskSubscription(runner.runTaskStream);
                        expect(subscription).to.have.property('dispose').that.is.a('function');
                    });

                    it('should filter empty tasks', function(done) {
                        runner.running = true;
                        store.checkoutTask.resolves();
                        var subscription = runner.createRunTaskSubscription(runner.runTaskStream);
                        runner.runTaskStream.onNext(taskAndGraphId);
                        setImmediateAssertWrapper(done, function() {
                            expect(store.checkoutTask).to.have.been.calledOnce;
                            expect(store.getTaskById).to.not.have.been.called;
                            subscription.dispose();
                        });
                    });

                    it('should run a task', function(done) {
                        runner.running = true;
                        store.checkoutTask.resolves(taskAndGraphId);
                        store.getTaskById.resolves();
                        runner.runTask = this.sandbox.stub().resolves();
                        runner.handleStreamSuccess = this.sandbox.stub();
                        runner.createRunTaskSubscription(runner.runTaskStream);
                        runner.runTaskStream.onNext(taskAndGraphId);
                        setImmediateAssertWrapper(done, function() {
                            expect(runner.runTask).to.have.been.calledOnce;
                            expect(runner.handleStreamSuccess).to.have.been.calledOnce;
                        });
                    });

                    it('should handle stream errors without crashing the parent stream', function(done) {
                        runner.running = true;
                        store.checkoutTask.resolves(taskAndGraphId);
                        store.checkoutTask.onCall(1).throws(new Error('checkout error'));
                        store.getTaskById.resolves();
                        store.getTaskById.onCall(0).throws(new Error('get task error'));
                        runner.runTask = this.sandbox.stub().resolves();
                        var eSpy = sinon.spy(runner, 'handleStreamError');
                        runner.handleStreamSuccess = this.sandbox.stub();

                        var subscription = runner.createRunTaskSubscription(runner.runTaskStream);

                        runner.runTaskStream.onNext();
                        runner.runTaskStream.onNext();
                        runner.runTaskStream.onNext();

                        setImmediateAssertWrapper(done, function() {
                            expect(eSpy.callCount).to.equal(2);
                            expect(runner.handleStreamSuccess).to.be.calledOnce;
                        });
                    });
                });

                describe('createHeartbeatSubscription', function() {

                    beforeEach(function() {
                        this.sandbox.restore();
                        runner = TaskRunner.create();
                        store.heartbeatTasksForRunner = this.sandbox.stub().resolves();
                        runner.handleStreamSuccess = this.sandbox.stub();
                    });

                    it('should heartbeat Tasks on an interval', function(done) {
                        runner.running = true;
                        runner.heartbeatInterval = 20;
                        runner.createHeartbeatSubscription();
                        setTimeout(asyncAssertWrapper(done, function() {
                            expect(store.heartbeatTasksForRunner.callCount).to.equal(2);
                            expect(runner.handleStreamSuccess.callCount).to.equal(2);
                        }), 59);
                    });

                    it('should not beat when the runner is not running', function(done) {
                        runner.running = false;
                        runner.createHeartbeatSubscription(1);
                        setTimeout(asyncAssertWrapper(done, function() {
                            expect(store.heartbeatTasksForRunner).to.not.have.been.called;
                        }), 20);
                    });

                    it('should return a disposable subscription', function() {
                        var subscription = runner.createHeartbeatSubscription(500);
                        expect(subscription).to.have.property('dispose').that.is.a('function');
                        subscription.dispose();
                    });

                    it('should stop the runner on Error', function(done) {
                        runner.running = true;
                        runner.heartbeatInterval = 1;
                        store.heartbeatTasksForRunner = this.sandbox.stub().throws(new Error('test error'));
                        runner.stop = this.sandbox.stub();
                        runner.createHeartbeatSubscription();
                        setTimeout(asyncAssertWrapper(done, function() {
                            expect(store.heartbeatTasksForRunner).to.have.been.calledOnce;
                            expect(runner.handleStreamSuccess).to.have.been.calledOnce;
                            expect(runner.stop).to.have.been.calledOnce;
                        }), 20);
                    });
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

        it('should run a task', function() {
            runner.runTask(data).subscribe(function() {
                expect(stubbedTask.run).to.have.been.calledOnce;
            });
        });

        it('should add and remove tasks from its activeTasks list', function(done) {
            runner.runTask(data).subscribe(function() {
                expect(runner.activeTasks[taskDef.instanceId]).to.equal(stubbedTask);
            });
            setImmediateAssertWrapper(done, function() {
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
            stubbedTask.run.onCall(1).throws(new Error('test error'));
            stubbedTask.run.resolves(finishedTask);
            var successSpy = sinon.spy(runner, 'handleStreamSuccess');// = this.sandbox.stub().returns(Rx.Observable.empty());
            var errorSpy = sinon.spy(runner, 'handleStreamError');// = this.sandbox.stub().returns(Rx.Observable.empty());
            store.checkoutTask = this.sandbox.stub().resolves({ task: 'taskStuff'});
            store.getTaskById = this.sandbox.stub().resolves(data);
            var subscription = runner.createRunTaskSubscription(runner.runTaskStream);

            runner.runTaskStream.onNext();
            runner.runTaskStream.onNext();
            runner.runTaskStream.onNext();

            setImmediateAssertWrapper(done, function() {
                expect(errorSpy).to.be.called.once;
                expect(successSpy).to.be.calledTwice;
            });
        });
    });
});
