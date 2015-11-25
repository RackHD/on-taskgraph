// Copyright 2015, EMC, Inc.

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
        this.startGraphStream = new Rx.Subject();
        this.pollInterval = options.pollInterval || 3000;
        this.concurrencyMaximums = this.getConcurrencyMaximums(options.concurrent);
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
            checkTaskStateHandledByGraph: 25,
            findReadyTasks: 25,
            handleFailGraphEvent: 25,
            updateTaskDependencies: 25,
            handleScheduleTaskEvent: 25,
            findUnevaluatedTasks: 1
        });
        return _.transform(_options, function(result, v, k) {
            result[k] = self.concurrentCounter(v);
        }, {});
    };

    TaskScheduler.prototype.initializePipeline = function() {
        assert.ok(this.running, 'scheduler is running');

        var taskHandlerStream = this.createTaskHandlerStream(this.evaluateTaskStream);
        var readyTaskStream = this.createReadyTaskStream(this.evaluateGraphStream);

        this.createUnevaluatedTaskPollerSubscription(this.evaluateTaskStream);
        this.createEvaluatedTaskPollerSubscription(this.evaluateGraphStream);
        this.createGraphFailSubscription(taskHandlerStream);
        this.createUpdateTaskDependenciesSubscription(taskHandlerStream, this.evaluateGraphStream);
        this.createTasksToScheduleSubscription(readyTaskStream);
        this.createGraphFinishedSubscription(readyTaskStream);
        this.createStartTaskGraphSubscription(this.startGraphStream, this.evaluateGraphStream);
    };

    TaskScheduler.prototype.isRunning = function() {
        return this.running;
    };

    TaskScheduler.prototype.createTaskHandlerStream = function(evaluateTaskStream) {
        var self = this;
        return evaluateTaskStream
        .takeWhile(self.isRunning.bind(self))
        .tap(self.handleStreamDebug.bind(self, 'Received evaluate task event'))
        .map(self.checkTaskStateHandledByGraph.bind(self))
        .mergeLossy(self.concurrencyMaximums.checkTaskStateHandledByGraph)
        .share();
    };

    TaskScheduler.prototype.createReadyTaskStream = function(evaluateGraphStream) {
        var self = this;
        return evaluateGraphStream
        .takeWhile(self.isRunning.bind(self))
        .tap(self.handleStreamDebug.bind(self, 'Received evaluate graph event'))
        .map(self.findReadyTasks.bind(self))
        .mergeLossy(self.concurrencyMaximums.findReadyTasks)
        .share();
    };

    TaskScheduler.prototype.checkTaskStateHandledByGraph = function(data) {
        assert.object(data, 'task data object');
        var self = this;

        return Rx.Observable.just(data)
        .flatMap(function(data) {
            if (_.contains(Constants.TaskStates.FailedTaskStates, data.state)) {
                return store.isTaskFailureHandled(data.graphId, data.taskId, data.state)
                .then(function(handled) {
                    data.unhandledFailure = !handled;
                    return data;
                });
            } else {
                data.unhandledFailure = false;
                return Promise.resolve(data);
            }
        })
        .catch(self.handleStreamError.bind(self,
                    'Error checking if task state is handled by graph'));
    };

    // graphId is optional
    TaskScheduler.prototype.findReadyTasks = function(data) {
        assert.object(data);
        var self = this;

        return Rx.Observable.just(data)
        .flatMap(function(_data) {
            return store.findReadyTasks(self.domain, _data.graphId);
        })
        .catch(self.handleStreamError.bind(self, 'Error finding ready tasks'));
    };

    TaskScheduler.prototype.createGraphFailSubscription = function(taskHandlerStream) {
        var self = this;
        return taskHandlerStream
        .takeWhile(self.isRunning.bind(self))
        .filter(function(data) { return data.unhandledFailure; })
        .tap(self.handleStreamDebug.bind(self, 'Handling unhandled graph failure'))
        .map(self.handleFailGraphEvent.bind(self))
        .mergeLossy(self.concurrencyMaximums.handleFailGraphEvent)
        .subscribe(
            self.handleStreamSuccess.bind(
                self, 'Graph failed due to unhandled task failure'),
            self.handleStreamError.bind(self, 'Error at graph fail stream')
        );
    };

    TaskScheduler.prototype.handleFailGraphEvent = function(data) {
        return Rx.Observable.just(data)
        .flatMap(this.failGraph.bind(this))
        .catch(this.handleStreamError.bind(this), 'Error failing graph');
    };

    TaskScheduler.prototype.createUpdateTaskDependenciesSubscription =
        function(taskHandlerStream, evaluateGraphStream) {

        var self = this;
        return taskHandlerStream
        .takeWhile(self.isRunning.bind(self))
        .filter(function(data) { return !data.unhandledFailure; })
        .map(self.updateTaskDependencies.bind(self))
        .mergeLossy(self.concurrencyMaximums.updateTaskDependencies)
        .tap(function(task) {
            var _task = _.pick(task, ['domain', 'graphId', 'taskId']);
            self.handleStreamDebug('Updated dependencies for task', _task);
        })
        .map(function(data) { return { graphId: data.graphid }; })
        .subscribe(
            evaluateGraphStream.onNext.bind(evaluateGraphStream),
            self.handleStreamError.bind(self, 'Error at update task dependencies stream')
        );
    };

    TaskScheduler.prototype.createTasksToScheduleSubscription = function(readyTaskStream) {
        var self = this;
        return readyTaskStream
        .takeWhile(self.isRunning.bind(self))
        .filter(function(data) { return !_.isEmpty(data.tasks); })
        .pluck('tasks')
        .flatMap(function(tasks) { return Rx.Observable.from(tasks); })
        .map(self.handleScheduleTaskEvent.bind(self))
        .mergeLossy(self.concurrencyMaximums.handleScheduleTaskEvent)
        .tap(function(task) {
            var _task = _.pick(task, ['domain', 'graphId', 'taskId']);
            self.handleStreamDebug('Received schedule task event', _task);
        })
        .subscribe(
            self.handleStreamSuccess.bind(self, 'Task scheduled'),
            self.handleStreamError.bind(self, 'Error at task scheduling stream')
        );
    };

    TaskScheduler.prototype.handleScheduleTaskEvent = function(data) {
        var self = this;
        assert.object(data, 'task data object');

        return Rx.Observable.just(data)
        .flatMap(self.publishScheduleTaskEvent.bind(self))
        .catch(self.handleStreamError.bind(self, 'Error scheduling task'));
    };

    TaskScheduler.prototype.createStartTaskGraphSubscription =
        function(startGraphStream, evaluateGraphStream) {

        var self = this;
        return startGraphStream
        .takeWhile(self.isRunning.bind(self))
        .flatMap(self.handleStartTaskGraphEvent.bind(self))
        .subscribe(
            evaluateGraphStream.onNext.bind(evaluateGraphStream),
            self.handleStreamError.bind(this, 'Error at start taskgraph stream')
        );
    };

    TaskScheduler.prototype.handleStartTaskGraphEvent = function(data) {
        assert.object(data, 'graph data object');
        var self = this;

        return Rx.Observable.just(data)
        .flatMap(TaskGraph.create.bind(TaskGraph, self.domain))
        .flatMap(function(graph) {
            var async = [
                Rx.Observable.just({ graphId: graph.instanceId }),
                store.persistGraphObject(graph)
            ];
            var items = graph.createTaskDependencyItems().map(function(item) {
                return store.persistTaskDependencies(item, graph.instanceId);
            });
            return Rx.Observable.forkJoin(async.concat(items));
        })
        .map(_.first)
        .catch(self.handleStreamError.bind(self, 'Error starting task graph'));
    };

    TaskScheduler.prototype.createGraphFinishedSubscription = function(readyTaskStream) {
        var self = this;

        return readyTaskStream
        .takeWhile(self.isRunning.bind(self))
        .filter(function(data) { return _.isEmpty(data.tasks) || !data.graphId; })
        .flatMap(self.handleGraphFinishedEvent.bind(self))
        .subscribe(
            self.handleStreamSuccess.bind(self, 'Graph finished'),
            self.handleStreamError.bind(self, 'Error at graph finished stream')
        );
    };

    TaskScheduler.prototype.handleGraphFinishedEvent = function(data) {
        assert.object(data, 'graph data object');
        var self = this;

        return Rx.Observable.just(data)
        .flatMap(function(data) {
            if (!data.graphId) {
                return self.findPotentialFinishedGraphs(data);
            } else {
                return Rx.Observable.just(data);
            }
        })
        .flatMap(store.checkGraphFinished.bind(store))
        .filter(function(_data) { return _data.done; })
        .flatMap(store.setGraphDone.bind(store, Constants.TaskStates.Succeeded))
        .filter(function(graph) { return !_.isEmpty(graph); })
        .map(function(graph) { return _.pick(graph, ['instanceId', '_status']); })
        .tap(self.publishGraphFinished.bind(self))
        .catch(self.handleStreamError.bind(self, 'Error handling graph done event'));
    };

    /**
     * Handle cases where all tasks have been evaluated but the active scheduler
     * crashes before determining if the graph is finished.
     *
     * @memberOf InstallOsJob
     */
    TaskScheduler.prototype.findPotentialFinishedGraphs = function(data) {
        return Rx.Observable.just(data)
        .flatMap(store.findActiveGraphs.bind(store, this.domain))
        .flatMap(function(graphs) {
            var candidateData = _.transform(graphs, function(result, graph) {
                var hasReadyTasks = _.some(data.tasks, function(task) {
                    return task.graphId === graph.instanceId;
                });
                if (!hasReadyTasks) {
                    result.push({ graphId: graph.instanceId, tasks: [] });
                }
            }, []);
            return Rx.Observable.from(candidateData);
        });
    };

    TaskScheduler.prototype.updateTaskDependencies = function(data) {
        assert.object(data, 'task dependency object');

        return Rx.Observable.just(data)
        .flatMap(function(data) {
            return Rx.Observable.forkJoin([
                Rx.Observable.just(data),
                store.setTaskStateInGraph(data),
                store.updateDependentTasks(data),
                store.updateUnreachableTasks(data)
            ]);
        })
        .map(_.first)
        .flatMap(store.markTaskEvaluated.bind(store))
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

    TaskScheduler.prototype.failGraph = function(data) {
        return store.setGraphDone(data.graphId, Constants.TaskStates.Failed)
        .then(function() {
            // TODO: cancel all outstanding graph tasks here
            // e.g. messenger.publishCancelTask(data...);
        });
    };

    TaskScheduler.prototype.createUnevaluatedTaskPollerSubscription = function(evaluateTaskStream) {
        var self = this;

        return Rx.Observable.interval(self.pollInterval)
        .takeWhile(self.isRunning.bind(self))
        .map(self.findUnevaluatedTasks.bind(self,
                    self.domain, self.concurrencyMaximums.checkTaskStateHandledByGraph.max))
        .mergeLossy(self.concurrencyMaximums.findUnevaluatedTasks)
        .flatMap(function(tasks) { return Rx.Observable.from(tasks); })
        .subscribe(
            evaluateTaskStream.onNext.bind(evaluateTaskStream),
            self.handleStreamError.bind(self, 'Error polling for tasks')
        );
    };

    TaskScheduler.prototype.createEvaluatedTaskPollerSubscription = function(evaluateGraphStream) {
        var self = this;

        return Rx.Observable.interval(self.pollInterval)
        .takeWhile(self.isRunning.bind(self))
        .subscribe(
            evaluateGraphStream.onNext.bind(evaluateGraphStream, {}),
            self.handleStreamError.bind(self, 'Error polling for tasks')
        );
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
        });
    };

    TaskScheduler.prototype.subscribeRunTaskGraph = function() {
        var self = this;
        return taskMessenger.subscribeRunTaskGraph(self.domain, self.runTaskGraphCallback);
    };

    TaskScheduler.prototype.runTaskGraphCallback = function(data) {
        data.injectableName = data.name;
        this.startGraphStream.onNext(data);
    };

    TaskScheduler.prototype.start = function() {
        var self = this;
        return Promise.resolve()
        .then(function() {
            self.running = true;
            self.pipelines = self.initializePipeline();
            self.leasePoller = LeaseExpirationPoller.create(self, {});
            self.leasePoller.start();
            return [self.subscribeRunTaskGraph(), self.subscribeTaskFinished()];
        })
        .spread(function() {
            logger.info('Task scheduler started', {
                schedulerId: self.schedulerId,
                domain: self.domain
            });
        })
        // TODO: remove test tap
        .tap(function() {
            var i = 0;
            setInterval(function() {
                if (i > 29) {
                    return;
                }
                i += 1;
                _.forEach(_.range(5), function() {
                    self.test();
                });
            }, 1000);
        });
    };

    TaskScheduler.prototype.test = function() {
        var delay = 0;
        var testObj = { definition: {
            friendlyName: 'noop-graph',
            injectableName: 'Graph.noop-example',
            options: {
                'noop-1': {
                    delay: delay
                },
                'noop-2': {
                    delay: delay
                },
                'parallel-noop-1': {
                    delay: delay
                },
                'parallel-noop-2': {
                    delay: delay
                }
            },
            tasks: [
                {
                    label: 'noop-1',
                    taskName: 'Task.noop'
                },
                {
                    label: 'noop-2',
                    taskName: 'Task.noop',
                    waitOn: {
                        'noop-1': 'finished'
                    }
                },
                {
                    label: 'parallel-noop-1',
                    taskName: 'Task.noop',
                    waitOn: {
                        'noop-1': 'finished',
                        'noop-2': ['finished', 'timeout']
                    }
                },
                {
                    label: 'parallel-noop-2',
                    taskName: 'Task.noop',
                    waitOn: {
                        'noop-1': ['finished'],
                        'noop-2': ['finished', 'timeout']
                    }
                }
            ]
        }};

        this.startGraphStream.onNext(testObj);
    };

    TaskScheduler.prototype.stop = function() {
        this.running = false;
        this.leasePoller.stop();
    };

    TaskScheduler.create = function() {
        return new TaskScheduler();
    };

    return TaskScheduler;
}
