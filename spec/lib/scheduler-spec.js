// Copyright 2014, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

describe("Scheduler", function() {
    var scheduler;

    before("before scheduler-spec", function() {
        helper.setupInjector([require('../../lib/scheduler')]);
        scheduler = helper.injector.get('TaskGraph.Scheduler');
    });

    describe("while running", function() {
        var uuid,
            taskProtocol,
            _wrapDataOrig;

        before("Scheduler Spec before: stub scheduler methods, state", function(done){
            uuid = helper.injector.get('uuid');
            taskProtocol = helper.injector.get('Protocol.Task');

            _wrapDataOrig = scheduler.wrapData;
            scheduler.wrapData = function pseudoWrapData(taskId, taskName)  {
                return {
                    id: taskId,
                    name: taskName || 'Scheduled Item Default',
                    timeout: this.options.defaultTimeout,
                    priority: this.options.defaultPriority,
                    timer: null,
                    stats: {
                        created: new Date(),
                        started: null,
                        completed: null
                    },
                    run: sinon.stub()
                };
            };

            sinon.stub(scheduler,'_createWorkItemSubscription').resolves();
            sinon.stub(scheduler,'removeSubscription');
            sinon.stub(scheduler, 'log');
            sinon.stub(taskProtocol, 'cancel');

            for(var i = 0; i < scheduler.options.concurrentTasks; i+=1 ) {
                scheduler.schedule(uuid.v4(),'testTask');
            }
            process.nextTick(function() {
                done();
            });
        });

        beforeEach("Scheduler Spec beforeEach: reset stubs", function(){
            scheduler._createWorkItemSubscription.reset();
            scheduler.removeSubscription.reset();
            scheduler.log.reset();
            taskProtocol.cancel.reset();
        });

        after("Scheduler Spec after: restore stubs", function(){
            scheduler.wrapData = _wrapDataOrig;
            scheduler._createWorkItemSubscription.restore();
            scheduler.removeSubscription.restore();
            scheduler.log.restore();
            taskProtocol.cancel.restore();
        });

        it("should not exceed max number of concurrent tasks", function(done) {
            //schedule two additional tasks
            for(var i = 0; i < 2; i+=1 ) {
                scheduler.schedule(uuid.v4(),'testTask');
            }
            process.nextTick(function() {
                expect(scheduler.currentlyRunning).to.equal(scheduler.options.concurrentTasks);
                expect(scheduler.stats.maxConcurrentExceeded).to.equal(2);
                done();
            });
        });

        it("should update running map as tasks are launched",function(){
            Object.keys(scheduler.running).should.have.length(scheduler.options.concurrentTasks);
        });

        it("should queue next scheduled items when max concurrent tasks is not met", function(done){
            _.forEach(scheduler.running, function(workItem) {
                scheduler.doneRunning(null, workItem);
            });
            process.nextTick(function() {
                expect(_.keys(scheduler.running)).to.have.length(2);
                expect(scheduler.currentlyRunning).to.equal(2);
                done();
            });
        });

        it("should forget about tasks when they are doneRunning", function(done){
            _.forEach(scheduler.running, function(workItem) {
                scheduler.doneRunning(null, workItem);
            });
            process.nextTick(function() {
                expect(scheduler.running).to.be.empty;
                expect(scheduler.currentlyRunning).to.equal(0);
                done();
            });
        });

        it("should shut down on request and cancel all running tasks", function(){
            _.range(scheduler.options.concurrentTasks).forEach(function(i) {
                scheduler.running[uuid.v4()] = 'testTask' + i;
            });
            scheduler.requestShutdown();
            taskProtocol.cancel.callCount.should.equal(scheduler.options.concurrentTasks);
        });

        describe("task timeouts", function() {
            var workItem = {
                stats: {},
                id: 'test work item id',
                run: function() {},
                timeout: undefined
            };

            before("task timeouts before", function() {
                sinon.stub(scheduler, "doneRunning");
            });

            beforeEach("task timeouts beforeEach", function() {
                clearTimeout(workItem.timer);
                workItem.timer = undefined;
            });

            afterEach("task timeouts afterEach", function() {
                scheduler.doneRunning.reset();
            });

            after("task timeouts after", function() {
                scheduler.doneRunning.restore();
            });

            it("should timeout a task", function(done) {
                var tasksTimedOut = scheduler.stats.tasksTimedOut;
                workItem.timeout = 1;

                scheduler.runWork(workItem)
                .then(function() {
                    expect(workItem.timer).to.be.an.object;

                    setTimeout(function() {
                        try {
                            expect(scheduler.doneRunning).to.have.been.calledOnce;
                            expect(tasksTimedOut + 1).to.equal(scheduler.stats.tasksTimedOut);
                            done();
                        } catch (e) {
                            done(e);
                        }
                    }, 10);
                })
                .catch(function(e) {
                    done(e);
                });
            });

            it("should not timeout a task with a timeout of <= 0", function(done) {
                var tasksTimedOut = scheduler.stats.tasksTimedOut;
                workItem.timeout = -1;
                return scheduler.runWork(workItem)
                .then(function() {
                    expect(workItem.timer).to.be.undefined;
                    setTimeout(function() {
                        try {
                            expect(scheduler.doneRunning).to.not.have.been.called;
                            expect(tasksTimedOut).to.equal(scheduler.stats.tasksTimedOut);
                            done();
                        } catch (e) {
                            done(e);
                        }
                    }, 10);
                })
                .catch(function(e) {
                    done(e);
                });
            });
        });
    });
});
