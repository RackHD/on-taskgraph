// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di');

module.exports = completedTaskPollerFactory;
di.annotate(completedTaskPollerFactory,
        new di.Provide('TaskGraph.CompletedTaskPoller'));
di.annotate(completedTaskPollerFactory,
    new di.Inject(
        'TaskGraph.Store',
        'Protocol.Events',
        'Logger',
        'Assert',
        'Constants',
        'Rx',
        '_'
    )
);

function completedTaskPollerFactory(
    store,
    eventsProtocol,
    Logger,
    assert,
    Constants,
    Rx,
    _
) {
    var logger = Logger.initialize(completedTaskPollerFactory);

    /**
     * The CompletedTaskPoller polls the store for any tasks that have been
     * finished or marked as unreachable (in the case of multiple branches of
     * execution within a graph). It also evaluates graph states for
     * completed tasks, and finally deletes them from the store so that it
     * doesn't grow to be too large.
     *
     * @param {String} domain
     * @param {Object} options
     * @constructor CompletedTaskPoller
     */
    function CompletedTaskPoller(domain, options) {
        options = options || {};
        this.running = false;
        this.pollInterval = options.pollInterval || 1000;
        this.concurrentCounter = { count: 0, max: 1 };
        this.completedTaskBatchSize = options.completedTaskBatchSize || 200;
        assert.number(this.completedTaskBatchSize, 'completedTaskBatchSize');
        this.domain = domain || Constants.Task.DefaultDomain;
        assert.string(this.domain, 'domain');
        this.debug = _.has(options, 'debug') ? options.debug : false;
    }

    /**
     * Poll the store for completed tasks.
     *
     * @memberOf CompletedTaskPoller
     */
    CompletedTaskPoller.prototype.pollTasks = function() {
        var self = this;
        /*
         * Before setting up the stream, make sure it is running, otherwise
         * this will create a stream that will never run and immediately complete.
         * This is basically defensive programming to try to prevent accidents where the
         * startup code is executed in the wrong order (e.g. pollTasks() then
         * this.running = true, that would be buggy because pollTasks() would
         * stop execution before this.running = true was set).
         */
        assert.ok(self.running, 'lease expiration poller is running');

        /*
         * For those unfamiliar with Rx.js:
         *
         * This Rx.Observable.interval call produces a continuously running
         * pipeline of the chained calls below, that triggers on every
         * pollInterval period. The reason for the .takeWhile call at the top is
         * to basically implement an auto-disposal mechanism: before doing any
         * of the subsequent logic, first check if we're still running and
         * just shut down whole stream if we're not. That way we don't have
         * to do any asynchronous disposal when stopping the service, we just
         * set a variable this.running = false.
         *
         * The .map call is where the actual work is done, and the rest of the
         * calls are just coordination about when to do it.
         */
        Rx.Observable.interval(self.pollInterval)
        .takeWhile(self.isRunning.bind(self))
        .map(self.processCompletedTasks.bind(self, self.completedTaskBatchSize))
        .mergeLossy(self.concurrentCounter)
        // Don't let processCompletedTasks return a waterline object to the logger
        // otherwise it will exceed the call stack trying to traverse a circular object
        .map(null)
        .subscribe(
            // Success handler callback. Only log in debug mode.
            self.handleStreamDebug.bind(self, 'CompletedTaskPoller stream pipeline success'),
            // Error handler callback. This is considered catastrophic, most errors
            // _should_ be caught at a lower level and not bubbled up.
            self.handleStreamError.bind(self, 'Error with completed task deletion stream.')
        );
    };

    /**
     * This is used with Rx.Observable.prototype.takeWhile in the Observable
     * created by CompletedTaskPoller.prototype.pollTasks. When isRunning()
     * returns false, all the observables will automatically dispose.
     *
     * @returns {Boolean}
     * @memberOf CompletedTaskPoller
     */
    CompletedTaskPoller.prototype.isRunning = function() {
        return this.running;
    };

    /**
     * Find <limit> number of completed tasks in the store and process them,
     * determining if any actions need to be taken in regards to the graph state,
     * and finally deleting the task documents from the store.
     *
     * @param {Number} limit
     * @returns {Observable}
     * @memberOf CompletedTaskPoller
     */
    CompletedTaskPoller.prototype.processCompletedTasks = function(limit) {
        return Rx.Observable.just()
        .flatMap(store.findCompletedTasks.bind(store, limit))
        .filter(function(tasks) { return !_.isEmpty(tasks); })
        .flatMap(this.deleteCompletedGraphs.bind(this))
        .flatMap(this.deleteTasks.bind(this))
        .catch(this.handleStreamError.bind(this, 'Error processing completed tasks'));
    };

    /**
     * Determine if a graph is finished, and if so mark its finished state
     * in the store and publish an event to the messenger.
     *
     * @param {Object} data
     * @returns {Observable}
     * @memberOf CompletedTaskPoller
     */
    CompletedTaskPoller.prototype.handlePotentialFinishedGraph = function(data) {
        assert.object(data, 'data');
        assert.string(data.state, 'data.state');
        var self = this;

        return Rx.Observable.just(data)
        .flatMap(function(data) {
            if (_.contains(Constants.Task.FailedStates, data.state)) {
                data.failed = true;
                data.done = true;
                return Rx.Observable.just(data);
            }
            return store.checkGraphSucceeded(data);
        })
        .flatMap(function(_data) {
            if (_data.done) {
                var graphState;
                if (data.failed) {
                    graphState = Constants.Task.States.Failed;
                } else {
                    graphState = Constants.Task.States.Succeeded;
                }

                return store.setGraphDone(graphState, _data)
                .then(function(graph) {
                    // Don't publish duplicate events if we've already set the graph as done
                    // prior, but DO continue with the outer stream so that we delete
                    // the task document whose existence triggered this check.
                    if (!_.isEmpty(graph)) {
                        self.publishGraphFinished(graph);
                    }
                });
            }
            return Rx.Observable.just();
        });
    };

    /**
     * Evaluate an array of finished tasks, and check if a graph is finished
     * for each task that is marked as being potentially terminal.
     *
     * @param {Array} tasks
     * @returns {Observable}
     * @memberOf CompletedTaskPoller
     */
    CompletedTaskPoller.prototype.deleteCompletedGraphs = function(tasks) {
        assert.arrayOfObject(tasks, 'tasks array');
        var terminalTasks = _.transform(tasks, function(result, task) {
            // Collect only terminal tasks (tasks that we know are the last or
            // one of the last tasks to run in a graph) for determing graph completion checks.
            // This logic handles cases where all tasks in a graph are completed,
            // but the graph completion event was dropped by the scheduler, either
            // due to high load or a process failure. Hooking onto task deletion
            // allows us to avoid doing full collection scans against graphobjects
            // to find potential unfinished graphs.
            if (_.contains(task.terminalOnStates, task.state)) {
                result.push(task);
            }
        });
        if (_.isEmpty(terminalTasks)) {
            return Rx.Observable.just(tasks);
        }

        return Rx.Observable.from(terminalTasks)
        .flatMap(this.handlePotentialFinishedGraph.bind(this))
        .bufferWithCount(terminalTasks.length)
        .map(tasks)
        .catch(this.handleStreamError.bind(this, 'Error handling potential finished graphs'));
    };

    /**
     * Delete task documents from the store
     *
     * @param {Array} tasks
     * @returns {Observable}
     * @memberOf CompletedTaskPoller
     */
    CompletedTaskPoller.prototype.deleteTasks = function(tasks) {
        assert.arrayOfObject(tasks, 'tasks array');
        var objectIds = _.map(tasks, function(task) {
            return task._id;
        });

        return Rx.Observable.just(objectIds)
        .flatMap(store.deleteTasks.bind(store))
        .catch(this.handleStreamError.bind(this, 'Error deleting completed tasks'));
    };

    /**
     * Publish a graph finished event to the messenger.
     *
     * @param {Object} graph
     * @returns {Promise}
     * @memberOf CompletedTaskPoller
     */
    CompletedTaskPoller.prototype.publishGraphFinished = function(graph) {
        return eventsProtocol.publishGraphFinished(graph.instanceId, graph._status)
        .catch(function(error) {
            logger.error('Error publishing graph finished event', {
                graphId: graph.instanceId,
                _status: graph._status,
                error: error
            });
        });
    };

    /**
     * Log handler for observable onError failure events.
     *
     * @param {String} msg
     * @param {Object} err
     * @returns {Observable}
     * @memberOf CompletedTaskPoller
     */
    CompletedTaskPoller.prototype.handleStreamError = function(msg, err) {
        logger.error(msg, {
            // stacks on some error objects (particularly from the assert library)
            // don't get printed if part of the error object so separate them out here.
            error: _.omit(err, 'stack'),
            stack: err.stack
        });
        return Rx.Observable.empty();
    };

    /**
     * Log handler for debug messaging during development/debugging. Only
     * works when this.debug is set to true;
     *
     * @param {String} msg
     * @param {Object} data
     * @returns {Observable}
     * @memberOf CompletedTaskPoller
     */
    CompletedTaskPoller.prototype.handleStreamDebug = function(msg, data) {
        if (this.debug) {
            logger.debug(msg, data);
        }
    };

    /**
     * @memberOf CompletedTaskPoller
     */
    CompletedTaskPoller.prototype.start = function() {
        this.running = true;
        this.pollTasks();
    };

    /**
     * @memberOf CompletedTaskPoller
     */
    CompletedTaskPoller.prototype.stop = function() {
        this.running = false;
    };

    /**
     * @returns {Object} CompletedTaskPoller instance
     * @memberOf CompletedTaskPoller
     */
    CompletedTaskPoller.create = function(domain, options) {
        return new CompletedTaskPoller(domain, options);
    };

    return CompletedTaskPoller;
}
