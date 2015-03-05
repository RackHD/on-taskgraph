// Copyright 2014, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

describe("Scheduler", function() {
    var scheduler;

    before("before scheduler-spec", function() {
        helper.setupInjector([require('../../lib/scheduler')]);
        scheduler = helper.injector.get('TaskGraph.Scheduler');
    });

    describe("Scheduler object", function(){
        it("should implement the scheduler interface", function(){
            scheduler.should.have.property('status').that.is.a('function').with.length(0);
            scheduler.should.have.property('wrapData').that.is.a('function').with.length(3);
            scheduler.should.have.property('requestShutdown').that.is.a('function').with.length(0);
            scheduler.should.have.property('schedule').that.is.a('function').with.length(3);
            scheduler.should.have.property('isQueueEmpty').that.is.a('function').with.length(0);
            scheduler.should.have.property('isRunningMaxTasks')
                .that.is.a('function').with.length(0);
            scheduler.should.have.property('evaluateWork').that.is.a('function').with.length(0);
            scheduler.should.have.property('fetchNext').that.is.a('function').with.length(0);
            scheduler.should.have.property('runWork').that.is.a('function').with.length(1);
            scheduler.should.have.property('_createWorkItemSubscription')
                .that.is.a('function').with.length(1);
            scheduler.should.have.property('removeSubscription')
                .that.is.a('function').with.length(1);
            scheduler.should.have.property('doneRunning').that.is.a('function').with.length(2);
            scheduler.should.have.property('start').that.is.a('function').with.length(0);
            scheduler.should.have.property('stop').that.is.a('function').with.length(0);
        });
    });

    describe("Scheduler in action", function() {
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

            sinon.stub(scheduler,'_createWorkItemSubscription');
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
            _.range(scheduler.options.concurrentTasks).forEach(function() {
                scheduler.schedule(uuid.v4(),'testTask');
            });
            scheduler.requestShutdown();
            taskProtocol.cancel.callCount.should.equal(scheduler.options.concurrentTasks);
        });
    });
});
