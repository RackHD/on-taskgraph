// Copyright 2015, EMC, Inc.
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
        'Errors',
        'uuid',
        'Promise',
        '_'
    )
);

/**
 *
 * @param logger
 * @returns {Scheduler}
 */
function factory(schedulerProtocol, eventsProtocol, taskProtocol, Logger,
        assert, util, Errors, uuid, Promise, _) {
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
        var self = this;

        // set options
        var optionDefaults = {
            name: 'Default Scheduler Name',
            concurrentTasks: 100,
            logLevel: 'info',
            defaultPriority: 50,
            defaultTimeout: (24 * 60 * 60 * 1000),
            maxCompletedTasks: 200
        };
        self.options = _.defaults(overrides || {}, optionDefaults);

        // set id for trace messages from self instance
        self.id = uuid.v4();

        self.shutdownRequested = false;

        // in memory queue of tasks to be run
        self.scheduled = [];

        self.subscriptions = {};

        // in memory map with key being internal wrapped work id
        self.running = {};

        // in order of completion work that was finished
        self.completed = lruCache({ max: self.options.maxCompletedTasks });

        // counter of work items in flight, used to limit concurrency
        self.currentlyRunning = 0;

        // used to signify that all work has been completed and shutdown is
        // complete after a shutdown is requested.
        self._deferred = new Promise(function(resolve, reject) {
            self.resolve = resolve;
            self.reject = reject;
        });

        // things we keep track of
        self.stats = {
            tasksQueued: 0,
            tasksTimedOut: 0,
            tasksError: 0,
            tasksSuccess: 0,
            maxConcurrentExceeded: 0,
            queueEmptied: 0,
            timesStatusPolled: 0,
            timeIdle: 0
        };

        self.on('workItemCompleted', self.evaluateWork.bind(self));
        self.on('workItemScheduled', self.evaluateWork.bind(self));

        // curry logger for simplification of calling log
        self.log = function log(message, object) {
            assert.ok(logger[self.options.logLevel]);
            logger[self.options.logLevel](message, object);
        }.bind(self);

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
            return taskProtocol.run(itemToSchedule.id);
        };

        return itemToSchedule;
    };

    /**
     *
     * @returns {*}
     */
    Scheduler.prototype.requestShutdown = function () {
        var self = this;

        if(self.shutdownRequested === true) {
            return self._deferred;
        }

        self.shutdownRequested = true;

        // send cancel to each task
        var canceled = [];
        _.values(self.running).forEach(function(workItem){
            canceled.push(taskProtocol.cancel(workItem));
        });

        //TODO: set timeout so we don't wait forever for shutdown
        Promise.all(canceled)
        .then(function(){
            self.log('shutdownComplete');
            self.emit('shutdownComplete');
            self.resolve(self.stats);
        })
        .catch(function(e) {
            self.reject(e);
        });

        return self._deferred;
    };

    /**
     *
     * @param task
     * @param schedulerOverrides
     * @returns {*}
     */
    Scheduler.prototype.schedule = function (taskId, taskName, schedulerOverrides) {
        var workItem = this.wrapData(taskId, taskName, schedulerOverrides);
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
        if (this.currentlyRunning >= this.options.concurrentTasks) {
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
        var self = this;
        self.log('Run Task: ' + workItem.id);

        return self._createWorkItemSubscription(workItem)
        .then(function() {
            // mark work item as started
            workItem.stats.started = new Date();
            self.running[workItem.id] = workItem;
            workItem.run();

            if (workItem.timeout > 0) {
                // set up to expire the work item if it times out first
                workItem.timer = setTimeout(function(){
                    self.stats.tasksTimedOut += 1;
                    self.doneRunning("timeout", workItem);
                }, workItem.timeout);
            }

            self.emit('runWorkItem', workItem);
        })
        .catch(function(error) {
            logger.error("Error running work item.", {
                error: error,
                workItem: workItem
            });
        });
    };

    /*
     * Subscribe to events from a specific task
     * @param workItem
     */
    Scheduler.prototype._createWorkItemSubscription = function(workItem) {
        var self = this;
        return eventsProtocol.subscribeTaskFinished(
            workItem.id,
            function() {
                self.removeSubscription(workItem.id);
                self.doneRunning(null, workItem);
            }
        ).then(function(subscription) {
            self.subscriptions[workItem.id] = subscription;
        });
    };

    /*
     * Remove a subscriber specific to a task
     * @param workItemId
     */
    Scheduler.prototype.removeSubscription = function(workItemId) {
        var self = this;
        assert.ok(this.subscriptions[workItemId], 'Task subscription for ' + workItemId);

        self.subscriptions[workItemId].dispose().then(function() {
            delete self.subscriptions[workItemId];
        }).catch(function(error) {
            logger.error("Error disposing of Task subscription.", {
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
    Scheduler.prototype.doneRunning = function(err, workItem) {
        var self = this;


        // delete/clear timeout to be kind to resources
        if(workItem.timer) {
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
                taskProtocol.cancel(workItem.id, Errors.TaskTimeoutError.name,
                        'Task timed out after %sms'.format(workItem.timeout));
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
                function(taskId, taskName, schedulerOverrides) {
                    self.schedule(taskId, taskName, schedulerOverrides);
                }
        ).then(function(subscription) {
            self.subscriptions.Scheduler = subscription;
        });
    };

    Scheduler.prototype.stop = function() {
        return Promise.all(_.map(this.subscriptions, function(subscription) {
            return subscription.dispose();
        }));
    };

    return new Scheduler();
}
