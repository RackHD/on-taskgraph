// Copyright 2014, Renasar Technologies Inc.
/* jshint: node:true */
'use strict';
var di = require('di'),
    events = require('events'),
    lruCache = require('lru-cache');

module.exports = factory;
di.annotate(factory, new di.Provide('TaskGraph.Scheduler'));
di.annotate(factory,
    new di.Inject(
        'Protocol.Scheduler',
        'Protocol.Events',
        'Protocol.Task',
        'Logger',
        'Assert',
        'Util',
        'uuid',
        'Q',
        '_'
    )
);

/**
 *
 * @param logger
 * @returns {Scheduler}
 */
function factory(schedulerProtocol, eventsProtocol, taskProtocol, Logger,
        assert, util, uuid, Q, _) {
    var logger = Logger.initialize(factory);

    /**
     * Scheduler is responsible for taking a task or tasks and actually
     * launching them by calling their run().  More complex schedulers can
     * make use of queues hinted through tags, etc.
     * @param overrides
     * @returns {factory.Scheduler}
     * @constructor
     */
    function Scheduler(overrides) {
        if (!(this instanceof Scheduler)) {
            return new Scheduler(overrides);
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
        this.options = _.defaults(overrides || {}, optionDefaults);

        // set id for trace messages from this instance
        this.id = uuid.v4();

        this.shutdownRequested = false;

        // in memory queue of tasks to be run
        this.scheduled = [];

        this.subscriptions = {};

        // in memory map with key being internal wrapped work id
        this.running = {};

        // in order of completion work that was finished
        this.completed = lruCache({ max: this.options.maxCompletedTasks });

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
            timesStatusPolled: 0,
            timeIdle: 0
        };

        this.on('workItemCompleted', this.evaluateWork.bind(this));
        this.on('workItemScheduled', this.evaluateWork.bind(this));

        // curry logger for simplification of calling log
        this.log = function log(message, object) {
            assert.ok(logger[this.options.logLevel]);
            logger[this.options.logLevel](message, object);
        }.bind(this);

        return this;
    }
    util.inherits(Scheduler, events.EventEmitter);

    /**
     *
     * @returns {{queueLength: *, running: (Window.length|*), shutdownRequested: *, stats: *}}
     */
    Scheduler.prototype.status = function () {
        return {
            queueLength: this.scheduled.length,
            running: _.keys(this.running).length,
            shutdownRequested: this.shutdownRequested,
            stats: this.stats
        };
    };

    /**
     *
     * @type {{run: Function}}
     */
    Scheduler.prototype.noop = {run:function(){return Q.resolve(true);}};

    /**
     *
     * @param task
     * @param schedulerOverrides
     * @returns {*}
     */
    Scheduler.prototype.wrapData = function (taskId, taskName, schedulerOverrides) {
        assert.uuid(taskId, 'Schedulable Task instanceId');
        assert.string(taskName, 'Schedulable Task name');

        var defaults = {
            id: taskId,
            name: taskName || 'Scheduled Item Default',
            timeout: this.options.defaultTimeout,
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

        itemToSchedule.run = function() {
            return taskProtocol.run(taskId);
        };

        return itemToSchedule;
    };

    /**
     *
     * @returns {*}
     */
    Scheduler.prototype.shutdownRequested = function () {
        if(this.shutdownRequests === true) {
            return this.complete;
        }

        this.shutdownRequested = true;

        // send cancel to each task
        var canceled = [];
        _.values(this.running).forEach(function(workItem){
            canceled.push(workItem.task.cancel.bind(workItem.task));
        });

        //TODO: set timeout so we don't wait forever for shutdown

        var self = this;
        Q.all(canceled)
            .then(function(){
                this.log('shutdownComplete');
                self.emit('shutdownComplete');
                self.complete.resolve(self.stats);
            });
        return this.complete;
    };

    /**
     *
     * @param task
     * @param schedulerOverrides
     * @returns {*}
     */
    Scheduler.prototype.schedule = function (taskId, schedulerOverrides) {
        var workItem = this.wrapData(taskId, schedulerOverrides);
        this.scheduled.push(workItem);
        this.log('workItemScheduled: ' + workItem.id);
        this.emit('workItemScheduled');
    };

    /**
     * are we already done with all the queued work?
     * @returns {boolean}
     */
    Scheduler.prototype.isQueueEmpty = function() {
        if (this.scheduled.length === 0) {
            this.stats.queueEmptied += 1;
            this.log('Work Queue Now Empty');
            this.emit('queueEmpty');
            return true;
        }
        return false;
    };

    /**
     * are we already running the maximum number of tasks?
     * @returns {boolean}
     */
    Scheduler.prototype.isRunningMaxTasks = function() {
        if (this.running >= this.options.concurrentTasks) {
            this.stats.maxConcurrentExceeded += 1;
            this.log('All Workers Busy');
            this.emit('maxConcurrentExceeded');
            return true;
        }
        return false;
    };

    /**
     * Run each time a piece of work is added to the scheduler or a
     * piece of work finishes (completes or fails), invoked as a result
     * of the event wireup in the constructor
     */
    Scheduler.prototype.evaluateWork = function () {
        this.log('evaluateWork');

        if(this.isQueueEmpty() || this.isRunningMaxTasks()) {
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

    /**
     * fetch next item of work from scheduled queue
     * @returns {*|T}
     */
    Scheduler.prototype.fetchNext = function(){
        // sort based on priority
        this.scheduled = _.sortBy(this.scheduled, 'pri');

        // take next work item
        return this.scheduled.shift();
    };

    /**
     * run the specified work item
     * @param workItem
     */
    Scheduler.prototype.runWork = function (workItem) {
        // mark work item as started
        workItem.stats.started = new Date();

        var self = this;

        this.log('Run Work Item: ' + workItem.id);
        this.running[workItem.id] = workItem;

        workItem.run();
        this._createWorkItemSubscription(workItem);

        // set up to expire the work item if it times out first
        workItem.timer = setTimeout(function(){
            self.stats.tasksTimedOut += 1;
            self.doneRunning("timeout", workItem);
            return;
        }, workItem.timeout);

        this.emit('runWorkItem', workItem);
    };

    /*
     * Subscribe to events from a specific task
     * @param workItem
     */
    Scheduler.prototype._createWorkItemSubscription = function(workItem) {
        var self = this;
        eventsProtocol.subscribeTaskFinished(
            workItem.id,
            function() {
                self.removeSubscription(workItem.id);
                self.doneRunning(workItem);
            }
        ).then(function(subscription) {
            self.subscriptions[workItem.id] = subscription;
        })
        .catch(function(error) {
            logger.error("Error creating work item subscription.", {
                error: error,
                workItem: workItem
            });
        });
    };

    /*
     * Remove a subscriber specific to a task
     * @param workItemId
     */
    Scheduler.prototype.removeSubscription = function(workItemId) {
        var self = this;
        assert.ok(this.subscriptions[workItemId], 'Work Item subscription for ' + workItemId);

        self.subscriptions[workItemId].dispose().then(function() {
            delete self.subscriptions[workItemId];
        }).catch(function(error) {
            logger.error("Error disposing of Work Item subscription.", {
                error: error,
                subscription: self.subscriptions[workItemId]
            });
        });
    };

    /**
     * each time a task is done running this is called
     * @param err
     * @param value
     * @param workItem
     */
    Scheduler.prototype.doneRunning = function(err, value, workItem) {
        var self = this;


        // delete/clear timeout to be kind to resources
        if(workItem.timer !== null) {
            clearTimeout(workItem.timer);
        }

        // capture stats
        workItem.stats.finished = new Date();

        if(err !== null) {
            this.stats.tasksError += 1;
            workItem.result = {
                error: err,
                stats: workItem.stats,
                task: workItem.id
            };
            if (err === 'timeout') {
                taskProtocol.cancel(workItem.id);
            }
        } else {
            this.stats.tasksSuccess += 1;
            workItem.result = {
                stats: workItem.stats,
                task: workItem.id
            };
        }

        // remove from running
        delete self.running[workItem.id];

        // add to done
        self.completed.set(workItem.id, workItem);

        // reduce count of running tasks by one
        self.currentlyRunning -= 1;

        self.emit('workItemCompleted');
    };

    Scheduler.prototype.start = function() {
        var self = this;
        return schedulerProtocol.subscribeSchedule(
                function(taskId, schedulerOverrides) {
                    self.schedule(taskId, schedulerOverrides);
                }
        ).then(function(subscription) {
            self.subscriptions.Scheduler = subscription;
        });
    };

    Scheduler.prototype.stop = function() {
        return Q.all(this.subscriptions, function(subscription) {
            return subscription.dispose();
        });
    };

    return new Scheduler();
}
