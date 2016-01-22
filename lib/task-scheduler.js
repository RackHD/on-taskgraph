// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di');

module.exports = taskSchedulerFactory;
di.annotate(taskSchedulerFactory, new di.Provide('TaskGraph.TaskScheduler'));
di.annotate(taskSchedulerFactory,
    new di.Inject(
        'Protocol.Events',
        'TaskGraph.TaskGraph',
        'TaskGraph.Store',
        'TaskGraph.LeaseExpirationPoller',
        'Constants',
        'Logger',
        'Promise',
        'uuid',
        'Assert',
        '_',
        'Rx.Mixins',
        'Task.Messenger'
    )
);

function taskSchedulerFactory(
    eventsProtocol,
    TaskGraph,
    store,
    LeaseExpirationPoller,
    Constants,
    Logger,
    Promise,
    uuid,
    assert,
    _,
    Rx,
    taskMessenger
) {
    var logger = Logger.initialize(taskSchedulerFactory);

    function TaskScheduler(options) {
        options = options || {};
        this.running = false;
        this.schedulerId = options.schedulerId || uuid.v4();
        this.domain = options.domain || Constants.DefaultTaskDomain;
        this.evaluateTaskStream = new Rx.Subject();
        this.evaluateGraphStream = new Rx.Subject();
        this.checkGraphFinishedStream = new Rx.Subject();
        this.pollInterval = options.pollInterval || 500;
        this.concurrencyMaximums = this.getConcurrencyMaximums(options.concurrent);
        this.subscriptions = [];
        this.leasePoller = null;
        this.debug = false;
    }

    TaskScheduler.prototype.concurrentCounter = function(max) {
        assert.number(max);
        return {
            count: 0,
            max: max
        };
    };

    TaskScheduler.prototype.getConcurrencyMaximums = function(concurrentOptions) {
        var self = this;
        var _options = _.defaults(concurrentOptions || {}, {
            // Favor evaluateGraphStream, since it's what results in actual
            // scheduling. If we're at load, defer evaluation in favor of scheduling.
            // TODO: Probably better as a priority queue, evaluateGraphStream events
            // always come up first?
            findReadyTasks: 100,
            updateTaskDependencies: 100,
            handleScheduleTaskEvent: 100,
            completeGraphs: 100,
            findUnevaluatedTasks: 1
        });
        return _.transform(_options, function(result, v, k) {
            result[k] = self.concurrentCounter(v);
        }, {});
    };

    TaskScheduler.prototype.initializePipeline = function() {
        assert.ok(this.running, 'scheduler is running');

        // Inputs from this.evaluateTaskStream
        // Outputs to this.evaluateGraphStream
        // Outputs to this.checkGraphFinishedStream
        this.createUpdateTaskDependenciesSubscription(
                this.evaluateTaskStream, this.evaluateGraphStream, this.checkGraphFinishedStream)
        .subscribe(
            this.handleStreamDebug.bind(this, 'Task evaluated'),
            this.handleStreamError.bind(this, 'Error at update task dependencies stream')
        );
        // Outputs to this.evaluateTaskStream
        this.createUnevaluatedTaskPollerSubscription(this.evaluateTaskStream)
        .subscribe(
            this.handleStreamDebug.bind(this, 'Triggered evaluate task event'),
            this.handleStreamError.bind(this, 'Error polling for tasks')
        );
        // Outputs to this.evaluateGraphStream
        this.createEvaluatedTaskPollerSubscription(this.evaluateGraphStream)
        .subscribe(
            this.handleStreamSuccess.bind(this, 'Triggered evaluate graph event'),
            this.handleStreamError.bind(this, 'Error polling for tasks')
        );
        // Inputs from this.evaluateGraphStream
        this.createTasksToScheduleSubscription(this.evaluateGraphStream)
        .subscribe(
            this.handleStreamSuccess.bind(this, 'Task scheduled'),
            this.handleStreamError.bind(this, 'Error at task scheduling stream')
        );
        // Inputs from this.checkGraphFinishedStream
        this.createCheckGraphFinishedSubscription(this.checkGraphFinishedStream)
        .subscribe(
            this.handleStreamSuccess.bind(this, 'Graph finished'),
            this.handleStreamError.bind(this, 'Error at check graph finished stream')
        );
    };

    TaskScheduler.prototype.isRunning = function() {
        return this.running;
    };

    // graphId is optional
    TaskScheduler.prototype.findReadyTasks = function(data) {
        assert.object(data);
        var self = this;

        return Rx.Observable.just(data)
        .flatMap(function() {
            return store.findReadyTasks(self.domain, data.graphId);
        })
        .catch(self.handleStreamError.bind(self, 'Error finding ready tasks'));
    };

    TaskScheduler.prototype.createUpdateTaskDependenciesSubscription =
        function(taskHandlerStream, evaluateGraphStream, checkGraphFinishedStream) {

        var self = this;

        return taskHandlerStream
        .takeWhile(self.isRunning.bind(self))
        .tap(self.handleStreamDebug.bind(self, 'Received evaluate task event'))
        .map(self.updateTaskDependencies.bind(self))
        .mergeLossy(self.concurrencyMaximums.updateTaskDependencies)
        .tap(function(task) {
            var _task = _.pick(task, ['domain', 'graphId', 'taskId']);
            self.handleStreamDebug('Updated dependencies for task', _task);
        })
        .filter(function(data) { return data; })
        .map(self.handleEvaluatedTask.bind(self, checkGraphFinishedStream, evaluateGraphStream));
    };

    TaskScheduler.prototype.handleEvaluatedTask = function(
            checkGraphFinishedStream, evaluateGraphStream, data) {
        if (_.contains(data.terminalOnStates, data.state)) {
            checkGraphFinishedStream.onNext(data);
        } else {
            evaluateGraphStream.onNext({ graphId: data.graphId });
        }
    };

    TaskScheduler.prototype.createTasksToScheduleSubscription = function(evaluateGraphStream) {
        var self = this;
        return evaluateGraphStream
        .takeWhile(self.isRunning.bind(self))
        .map(self.findReadyTasks.bind(self))
        .mergeLossy(self.concurrencyMaximums.findReadyTasks)
        .filter(function(data) { return !_.isEmpty(data.tasks); })
        .pluck('tasks')
        .flatMap(function(tasks) { return Rx.Observable.from(tasks); })
        .map(self.handleScheduleTaskEvent.bind(self))
        .mergeLossy(self.concurrencyMaximums.handleScheduleTaskEvent)
        .map(function(task) {
            return _.pick(task, ['domain', 'graphId', 'taskId']);
        });
    };

    TaskScheduler.prototype.handleScheduleTaskEvent = function(data) {
        var self = this;
        assert.object(data, 'task data object');

        return Rx.Observable.just(data)
        .flatMap(self.publishScheduleTaskEvent.bind(self))
        .catch(self.handleStreamError.bind(self, 'Error scheduling task'));
    };

    TaskScheduler.prototype.createCheckGraphFinishedSubscription = function(
            checkGraphFinishedStream) {
        var self = this;

        return checkGraphFinishedStream
        .takeWhile(self.isRunning.bind(self))
        .map(function(data) {
            // We already know that the task in question is in a terminal state,
            // otherwise we wouldn't have published data to this stream.
            if (_.contains(Constants.FailedTaskStates, data.state)) {
                return self.failGraph(data);
            } else {
                return self.checkGraphSucceeded(data);
            }
        })
        .mergeLossy(self.concurrencyMaximums.completeGraphs);
    };

    TaskScheduler.prototype.checkGraphSucceeded = function(data) {
        assert.object(data, 'graph data object');
        var self = this;

        return Rx.Observable.just(data)
        .filter(function(data) {return !_.isEmpty(data.graphId);})
        .flatMap(store.checkGraphFinished.bind(store))
        .filter(function(_data) { return _data.done; })
        .flatMap(store.setGraphDone.bind(store, Constants.TaskStates.Succeeded))
        .filter(function(graph) { return !_.isEmpty(graph); })
        .map(function(graph) { return _.pick(graph, ['instanceId', '_status']); })
        .tap(self.publishGraphFinished.bind(self))
        .catch(self.handleStreamError.bind(self, 'Error handling graph done event'));
    };

    TaskScheduler.prototype.failGraph = function(data) {
        return Rx.Observable.just(data)
        .tap(this.handleStreamDebug.bind(this, 'Handling graph failure'))
        .flatMap(function() {
            return store.setGraphDone(Constants.TaskStates.Failed, data)
            .then(function() {
                // TODO: cancel all outstanding graph tasks here
                // e.g. messenger.publishCancelTask(data...);
            });
        })
        .tap(this.handleStreamSuccess.bind(this, 'Graph failed due to unhandled task failure'))
        .catch(this.handleStreamError.bind(this, 'Error failing graph'));
    };


    /**
     * Handle cases where all tasks have been evaluated but the active scheduler
     * crashes before determining if the graph is finished.
     *
     * @memberOf InstallOsJob
     */

    TaskScheduler.prototype.updateTaskDependencies = function(data) {
        assert.object(data, 'task dependency object');
        return Rx.Observable.forkJoin([
            store.setTaskStateInGraph(data),
            store.updateDependentTasks(data),
            store.updateUnreachableTasks(data)
        ])
        .flatMap(store.markTaskEvaluated.bind(store, data))
        .catch(this.handleStreamError.bind(this, 'Error updating task dependencies'));
    };

    TaskScheduler.prototype.handleStreamSuccess = function(msg, data) {
        if (msg) {
            if (data) {
                data.schedulerId = this.schedulerId;
            }
            logger.debug(msg, data);
        }
        return Rx.Observable.empty();
    };

    TaskScheduler.prototype.handleStreamError = function(msg, err) {
        logger.error(msg, {
            schedulerId: this.schedulerId,
            // stacks on some error objects (particularly from the assert library)
            // don't get printed if part of the error object so separate them out here.
            error: _.omit(err, 'stack'),
            stack: err.stack
        });
        return Rx.Observable.empty();
    };

    TaskScheduler.prototype.handleStreamDebug = function(msg, data) {
        if (this.debug) {
            if (data) {
                data.schedulerId = this.schedulerId;
            }
            logger.debug(msg, data);
        }
    };

    TaskScheduler.prototype.subscribeTaskFinished = function() {
        var self = this;
        return taskMessenger.subscribeTaskFinished(
            this.domain,
            function(data) {
                logger.debug('Listener received task finished event, triggering evaluation', {
                    data: data,
                    schedulerId: self.schedulerId
                });
                self.evaluateTaskStream.onNext(data);
            }
        );
    };

    TaskScheduler.prototype.publishGraphFinished = function(graph) {
        return eventsProtocol.publishGraphFinished(graph.instanceId, graph._status)
        .catch(function(error) {
            logger.error('Error publishing graph finished event', {
                graphId: graph.instanceId,
                _status: graph._status,
                error: error
            });
        });
    };

    TaskScheduler.prototype.publishScheduleTaskEvent = function(data) {
        // TODO: Add more scheduling logic here when necessary
        return taskMessenger.publishRunTask(this.domain, data.taskId, data.graphId)
        .then(function() {
            return data;
        });
    };

    TaskScheduler.prototype.createUnevaluatedTaskPollerSubscription = function(evaluateTaskStream) {
        var self = this;

        return Rx.Observable.interval(self.pollInterval)
        .takeWhile(self.isRunning.bind(self))
        .map(self.findUnevaluatedTasks.bind(self, self.domain))
        .mergeLossy(self.concurrencyMaximums.findUnevaluatedTasks)
        .flatMap(function(tasks) { return Rx.Observable.from(tasks); })
        .map(evaluateTaskStream.onNext.bind(evaluateTaskStream));
    };

    TaskScheduler.prototype.createEvaluatedTaskPollerSubscription = function(evaluateGraphStream) {
        var self = this;

        return Rx.Observable.interval(self.pollInterval)
        .takeWhile(self.isRunning.bind(self))
        .map(evaluateGraphStream.onNext.bind(evaluateGraphStream, {}));
    };

    TaskScheduler.prototype.findUnevaluatedTasks = function(domain, limit) {
        return Rx.Observable.just()
        .flatMap(store.findUnevaluatedTasks.bind(store, domain, limit))
        .tap(function(tasks) {
            if (tasks && tasks.length) {
                logger.debug('Poller is triggering unevaluated tasks to be evaluated', {
                    tasks: _.map(tasks, 'taskId')
                });
            }
        })
        .catch(this.handleStreamError.bind(this, 'Error finding unevaluated tasks'));
    };

    TaskScheduler.prototype.subscribeRunTaskGraph = function() {
        return taskMessenger.subscribeRunTaskGraph(this.domain,
                this.runTaskGraphCallback.bind(this));
    };

    TaskScheduler.prototype.runTaskGraphCallback = function(data) {
        data.injectableName = data.name;
        this.evaluateGraphStream.onNext(data);
    };

    TaskScheduler.prototype.start = function() {
        var self = this;
        return Promise.resolve()
        .then(function() {
            self.running = true;
            self.initializePipeline();
            self.leasePoller = LeaseExpirationPoller.create(self, {});
            self.leasePoller.start();
            return [self.subscribeRunTaskGraph(), self.subscribeTaskFinished()];
        })
        .spread(function(runTaskGraphSubscription, taskFinishedSubscription) {
            self.subscriptions.push(runTaskGraphSubscription);
            self.subscriptions.push(taskFinishedSubscription);
            logger.info('Task scheduler started', {
                schedulerId: self.schedulerId,
                domain: self.domain
            });
        });
    };

    TaskScheduler.prototype.stop = function() {
        this.running = false;
        if (this.leasePoller) {
            this.leasePoller.stop();
        }
        return Promise.map(this.subscriptions, function(subscription) {
            return subscription.dispose();
        });
    };

    TaskScheduler.create = function() {
        return new TaskScheduler();
    };

    return TaskScheduler;
}
