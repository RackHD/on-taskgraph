// Copyright 2014, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

var di = require('di'),
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



describe("Scheduler", function(){
    var scheduler = new scheduleFactory(schedulerProtocol, eventsProtocol,
                                        taskProtocol, Logger, assert,
                                        Util, uuid, Q, _);
        sinon.stub(scheduler, 'log');

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

    it("should not exceed max number of concurrent tasks", function() {
        var  wStub = sinon.stub(scheduler, 'wrapData');

        sinon.stub(scheduler,'_createWorkItemSubscription');
        sinon.stub(scheduler,'removeSubscription');

            wStub.returns({
                id: uuid.v4(),
                name: 'Scheduled Item',
                timeout: scheduler.options.defaultTimeout,
                priority: scheduler.options.defaultPriority,
                timer: null,
                stats: {
                    created: new Date(),
                    started: null,
                    completed: null
                },
                run: sinon.stub()
            });

        for(var i = 1; i <= scheduler.options.concurrentTasks + 2; i+=1 ) {
            scheduler.schedule(uuid.v4(),'testTask');
        }

        scheduler.currentlyRunning
        .should.equal(scheduler.options.concurrentTasks);

        scheduler.stats.maxConcurrentExceeded
        .should.equal(2);

    });

});
