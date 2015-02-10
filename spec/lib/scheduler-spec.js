// Copyright 2014, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

require('../helper');
var _ = require('lodash');

/*var di = require('di'),
    _ = require('lodash'),
    core = require('renasar-core')(di),
    injector = new di.Injector(
            _.flatten(
                core.injectables
                )),
    schedulerProtocol = injector.get('Protocol.Scheduler'),
    eventsProtocol = injector.get('Protocol.Events'),
    taskProtocol = injector.get('Protocol.Task'),
    Logger = injector.get('Logger'),
    assert = injector.get('Assert'),
    Util = injector.get('Util'),
    uuid = injector.get('uuid'),
    Q = injector.get('Q'),
    scheduleFactory = require('../../lib/scheduler.js');
*/



describe("Scheduler", function() {
    var injector;
    var scheduler;

    describe("Scheduler object", function(){
        before("before scheduler-spec", function() {
            injector = helper.baseInjector.createChild(
                _.flatten([require('../../lib/scheduler')]));

            scheduler = injector.get('TaskGraph.Scheduler');
        });
/*        var scheduler = scheduleFactory(
            schedulerProtocol,
            eventsProtocol,
            taskProtocol,
            Logger,
            assert,
            Util,
            uuid,
            Q,
            _
        );
*/

        it("should implement the scheduler interface", function(){


            scheduler.should.have.property('status')
                .that.is.a('function').with.length(0);

            scheduler.should.have.property('wrapData')
                .that.is.a('function').with.length(3);

            scheduler.should.have.property('requestShutdown')
                .that.is.a('function').with.length(0);

            scheduler.should.have.property('schedule')
                .that.is.a('function').with.length(3);

            scheduler.should.have.property('isQueueEmpty')
                .that.is.a('function').with.length(0);

            scheduler.should.have.property('isRunningMaxTasks')
                .that.is.a('function').with.length(0);

            scheduler.should.have.property('evaluateWork')
                .that.is.a('function').with.length(0);

             scheduler.should.have.property('fetchNext')
                .that.is.a('function').with.length(0);

             scheduler.should.have.property('runWork')
                .that.is.a('function').with.length(1);

             scheduler.should.have.property('_createWorkItemSubscription')
                .that.is.a('function').with.length(1);

             scheduler.should.have.property('removeSubscription')
                .that.is.a('function').with.length(1);

             scheduler.should.have.property('doneRunning')
                .that.is.a('function').with.length(2);

             scheduler.should.have.property('start')
                .that.is.a('function').with.length(0);

             scheduler.should.have.property('stop')
                .that.is.a('function').with.length(0);

        });
    });

    describe("Scheduler in action", function() {
        var uuid,
            taskProtocol;

        beforeEach("beforeEach scheduler-spec", function(){
            injector = helper.baseInjector.createChild(
                _.flatten([require('../../lib/scheduler')]));


            scheduler = injector.get('TaskGraph.Scheduler');
            uuid = injector.get('uuid');
            taskProtocol = injector.get('Protocol.Task');

/*            scheduler = scheduleFactory(
                schedulerProtocol,
                eventsProtocol,
                taskProtocol,
                Logger,
                assert,
                Util,
                uuid,
                Q,
                _
            );
*/

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

             for(var i = 0; i < scheduler.options.concurrentTasks; i+=1 ) {
                scheduler.schedule(uuid.v4(),'testTask');
            }

        });

        afterEach(function(){
            scheduler._createWorkItemSubscription.restore();
            scheduler.removeSubscription.restore();
            scheduler.log.restore();
        });

        it("should not exceed max number of concurrent tasks", function() {

            //schedule two additional tasks
            for(var i = 0; i < 2; i+=1 ) {
                scheduler.schedule(uuid.v4(),'testTask');
            }

            scheduler.currentlyRunning
                .should.equal(scheduler.options.concurrentTasks);

            scheduler.stats.maxConcurrentExceeded
                .should.equal(2);
        });

        it("should update running map as tasks are launched",function(){

            Object.keys(scheduler.running)
                .should.have.length(scheduler.options.concurrentTasks);
        });

        it("should forget about tasks when they are doneRunning", function(){

            _.values(scheduler.running).forEach(function(task){
               scheduler.doneRunning(null, task);
            });


            scheduler.running.should.be.empty;
            scheduler.currentlyRunning.should.equal(0);
        });

        it("should shut down on request and cancel all running tasks", function(){
             _.range(scheduler.options.concurrentTasks).forEach(function() {
                scheduler.schedule(uuid.v4(),'testTask');
            });

            var cancelStub = sinon.stub(taskProtocol, 'cancel');

            scheduler.requestShutdown();

            cancelStub.callCount
                .should.equal(scheduler.options.concurrentTasks);

        });


    });
});
