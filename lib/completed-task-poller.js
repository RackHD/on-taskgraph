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

    function CompletedTaskPoller(domain, options) {
        options = options || {};
        assert.string(domain);
        this.running = false;
        this.pollInterval = options.pollInterval || (1000);
        this.concurrentCounter = { count: 0, max: 1 };
        this.completedTaskBatchSize = 200;
        this.domain = domain;
        this.debug = false;
    }

    CompletedTaskPoller.prototype.pollTasks = function() {
        var self = this;
        assert.ok(self.running, 'lease expiration poller is running');

        Rx.Observable.interval(self.pollInterval)
        .takeWhile(self.isRunning.bind(self))
        .map(self.processCompletedTasks.bind(self, self.completedTaskBatchSize))
        .mergeLossy(self.concurrentCounter)
        // Don't let processCompletedTasks return a waterline object to the logger
        // otherwise it will exceed the call stack trying to traverse a circular object
        .map(null)
        .subscribe(
            self.handleStreamDebug.bind(self, 'CompletedTaskPoller stream pipeline success'),
            self.handleStreamError.bind(self, 'Error with completed task deletion stream.')
        );
    };

    CompletedTaskPoller.prototype.isRunning = function() {
        return this.running;
    };

    CompletedTaskPoller.prototype.processCompletedTasks = function(limit) {
        return Rx.Observable.just()
        .flatMap(store.findCompletedTasks.bind(store, limit))
        .filter(function(tasks) { return !_.isEmpty(tasks); })
        .flatMap(this.deleteCompletedGraphs.bind(this))
        .flatMap(this.deleteTasks.bind(this))
        .catch(this.handleStreamError.bind(this, 'Error processing completed tasks'));
    };

    CompletedTaskPoller.prototype.handlePotentialFinishedGraph = function(data) {
        assert.object(data);
        var self = this;

        return Rx.Observable.just(data)
        .flatMap(function(data) {
            if (_.contains(Constants.FailedTaskStates, data.state)) {
                data.failed = true;
                data.done = true;
                return Rx.Observable.just(data);
            }
            return store.checkGraphFinished(data);
        })
        .flatMap(function(_data) {
            if (_data.done) {
                var graphState;
                if (data.failed) {
                    graphState = Constants.TaskStates.Failed;
                } else {
                    graphState = Constants.TaskStates.Succeeded;
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

    CompletedTaskPoller.prototype.deleteCompletedGraphs = function(tasks) {
        assert.arrayOfObject(tasks);
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

    CompletedTaskPoller.prototype.deleteTasks = function(tasks) {
        assert.arrayOfObject(tasks);
        var objectIds = _.map(tasks, function(task) {
            return task._id;
        });

        return Rx.Observable.just(objectIds)
        .flatMap(store.deleteTasks.bind(store))
        .catch(this.handleStreamError.bind(this, 'Error deleting completed tasks'));
    };

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

    CompletedTaskPoller.prototype.handleStreamError = function(msg, err) {
        logger.error(msg, {
            // stacks on some error objects (particularly from the assert library)
            // don't get printed if part of the error object so separate them out here.
            error: _.omit(err, 'stack'),
            stack: err.stack
        });
        return Rx.Observable.empty();
    };

    CompletedTaskPoller.prototype.handleStreamDebug = function(msg, data) {
        if (this.debug) {
            logger.debug(msg, data);
        }
    };

    CompletedTaskPoller.prototype.start = function() {
        this.running = true;
        this.pollTasks();
    };

    CompletedTaskPoller.prototype.stop = function() {
        this.running = false;
    };

    CompletedTaskPoller.create = function(domain, options) {
        return new CompletedTaskPoller(domain, options);
    };

    return CompletedTaskPoller;
}
