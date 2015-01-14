// Copyright 2014, Renasar Technologies Inc.
/* jshint: node:true */
'use strict';
var util = require('util'),
    events = require('events'),
    uuid = require('node-uuid'),
    _ = require ('lodash');

module.exports = factory;
di.annotate(factory, new di.Provide('Services.TaskScheduler'));
di.annotate(factory,
    new di.Inject(
        'Logger'
    )
);

/**
 *
 * @param logger
 * @returns {Scheduler}
 */
function factory(logger) {
    /**
     * Scheduler is responsible for taking a task or tasks and actually
     * launching them by calling their run().  More complex schedulers can
     * make use of queues hinted through tags, etc.
     * @param optionOverrides
     * @returns {factory.Scheduler}
     * @constructor
     */
    function Scheduler(optionOverrides) {
        if (!(this instanceof Scheduler)) {
            return new Scheduler(optionOverrides);
        }
        
        // set options
        var optionDefaults = {
            name: 'Default Scheduler Name',
            concurrentTasks: 3,
            logLevel: 'info',
            defaultPriority: 50,
            defaultTimeout: (10*1000),
            maxCompletedTasks: 200
        };
        this.options = _.defaults(optionOverrides || {}, optionDefaults);

        // set id for trace messages from this instance
        this.id = uuid.v4();
        
        this.shutdownRequested = false;
        
        // in memory queue of tasks to be run
        this.scheduled = [];
        
        // in memory map with key being internal wrapped work id
        this.running = {};
        
        // in order of completion work that was finished
        this.completed = [];
        
        // counter of work items in flight, used to limit concurrency
        this.currentlyRunning = 0;
        
        // used to signify that all work has been completed and shutdown is 
        // complete after a shutdown is requested.
        this._complete = Q.defer();
        this.complete = this._complete.promise;

        // things we keep track of
        this.stats = {
            tasksQueued: 0,
            tasksTimedOut: 0,
            tasksError: 0,
            tasksSuccess: 0,
            maxConcurrentExceeded: 0,
            queueEmptied: 0,
            timesStatusPolled: 0
            timeIdle: 0
        };

        // wire up internal events to actions to take
        this.on('workItemScheduled', this.evaluateWork.bind(this));
        this.on('workItemCompleted', this.evaluateWork.bind(this));

        // curry logger for simplification of calling log
        this.log = logger.log.bind (logger, this.options.loglevel);

        return this;
    }
    util.inherits(Scheduler, events.EventEmitter);

    Scheduler.prototype.status = function () {
        return {
            queueLength: this.scheduled.length,
            running: _.keys(this.running).length,
            shutdownRequested: this.shutdownRequested,
            stats: this.stats
        };
    };

    Scheduler.prototype.noop = {run:function(){return Q.resolve(true)}};

    Scheduler.prototype.wrapData = function (task,
                                             args,
                                             schedulerOverrides) {
        var defaults = {
            id: task.id || uuid.v4(),
            name: task.name || 'Scheduled Item Default',
            timeout: this.options.defaultTimeout,
            _result: Q.defer(),
            priority: this.options.defaultPriority,
            timer: null,
            stats: {
                created: new Date(),
                started: null,
                completed: null
            }
        };

        var itemToSchedule = _.defaults(
            schedulerOverrides || {},
            defaults);

        itemToSchedule.result =  _result.promise;
        itemToSchedule.task = task || this.noop;
        itemToSchedule.args = args || [];

        return itemToSchedule;
    };

    Scheduler.prototype.shutdownRequested = function () {
        if(this.shutdownRequests == true) {
            return this.complete;
        }

        this.shutdownRequested = true;

        // send cancel to each task
        var canceled = [];
        _.values(this.running).forEach(function(workItem){
            canceled.push(workItem.task.cancel.bind(workItem.task));
        });

        //TODO: set timeout so we don't wait forever.

        var self = this;
        Q.all(canceled)
            .then(function(){
                this.log('shutdownComplete');
                self.emit('shutdownComplete');
                self.complete.resolve(self.stats);
            });
        return this.complete;
    };

    Scheduler.prototype.schedule = function (task,
                                             args,
                                             schedulerOverides) {
        var workItem = this.wrapData(task, args, schedulerOverides);
        this.scheduled.push(workItem);
        this.log('workItemScheduled: ' + workItem.id);
        this.emit('workItemScheduled');

        // return promise to be fulfilled sometime later
        return workItem.result;
    };

    Scheduler.prototype.isQueueEmpty = function() {
        // are we already done with all the queued work?
        if (this.scheduled.length == 0) {
            this.stats.queueEmptied += 1;
            this.log('Work Queue Now Empty');
            this.emit('queueEmpty');
            return true;
        }
        return false;
    };

    Scheduler.prototype.isRunningMaxTasks = function() {
        // are we already running the maximum number of tasks?
        if (this.running >= this.options.concurrentTasks) {
            this.stats.maxConcurrentExceeded += 1;
            this.log('All Workers Busy');
            this.emit('maxConcurrentExceeded');
            return true;
        }
        return false;
    };

    Scheduler.prototype.evaluateWork = function () {
        this.log('evaluateWork');

        if(this.isQueueEmpty() || this.isRuningMaxTasks) {
            // we can't start new tasks so just wait for another to
            // be added or for one to complete or timeout
            return;
        }

        // we are now going to consume one of the task runners
        this.currentlyRunning += 1;

        // get next work item
        var workItem = this.fetchNext();

        // run work item
        this.runWork(workItem);
    };

    Scheduler.prototype.fetchNext = function(){
        // sort based on priority
        this.scheduled = _.sortBy(this.scheduled, 'pri');

        // take next work item
        return this.scheduled.shift();
    };

    Scheduler.prototype.runWork = function (workItem) {
        // mark work item as started
        workItem.stats.started = new Date();

        workItem.done = this.makeDone(workItem);
        var args = [].concat(workItem.args, workItem.done);

        workItem.result =
            workItem.task.run.apply(workItem.task,workItem.args);

        var self = this;
        workItem.timer = setTimeout(function(){
            workTimedOut._complete.reject("timeout", workTimedOut);
            this.stats.tasksTimedOut +=0;
            self.doneRunning("timeout", null, workItem);
            return;
        }, workItem.tiemout)

        this.log('Run Work Item: ' + workItem.id);
        this.running[workItem.id] = workItem;
        this.emit('runWorkItem', workItem);
        var workResult = this.runWork(workItem);

    };

    Scheduler.prototype.doneRunning = function(err, value, workItem) {
        // delete/clear timeout to be kind to resources
        if(workItem.timer != null) {
            clearTimeout(workItem.timer);
        }

        if(err != null) {
            workItem._result.reject(err)
            this.stats.tasksError += 1;
        } else {
            workItem._result.resolve(value);
            this.stats.tasksSuccess += 1;
        }

        // done running
        self.doneRunning(failedWork);

        // remove from running
        delete self.running[workItem.id];

        // add to done
        self.completed.push(workItem);

        // keep completed task list to reasonable length
        this.trimCompleted();

        // capture stats
        workItem.stats.finished = new Date();

        // reduce count of running tasks by one
        self.currentlyRunning -= 1;

        // event will trigger looking for next job if one exists.
        self.emit('workItemCompleted', current);
    };

    Scheduler.prototype.trimCompleted = function() {
        while(this.completed.length > this.options.maxCompletedTasks) {
            this.completed.shift();
        }
    };

    Scheduler.prototype.makeDone = function(workItem) {
        var self = this;
        var current = workItem;

        var done = function (err, value) {
            // done running
            self.doneRunning(err, value, current);
        };
        return done;
    };

    return Scheduler;
}
