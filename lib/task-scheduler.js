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
        'Constants',
        'Logger',
        'Promise',
        'uuid',
        'Assert',
        '_',
        'Rx',
        'Task.Messenger'
    )
);

function taskSchedulerFactory(
    eventsProtocol,
    TaskGraph,
    store,
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
        this.pipeline = null;
        this.pollInterval = options.pollInterval || 1000;
        this.debug = true;
    }

    TaskScheduler.prototype.initializePipeline = function() {
        var taskHandlerStream = this.createTaskHandlerStream(this.evaluateTaskStream);
        var readyTaskStream = this.createReadyTaskStream(this.evaluateGraphStream);

        return [
            this.createUnevaluatedTaskPollerSubscription(this.evaluateTaskStream),
            this.createEvaluatedTaskPollerSubscription(this.evaluateGraphStream),
            this.createGraphFailSubscription(taskHandlerStream),
            this.createUpdateTaskDependenciesSubscription(
                    taskHandlerStream, this.evaluateGraphStream),
            this.createTasksToScheduleSubscription(readyTaskStream),
            this.createGraphFinishedSubscription(readyTaskStream),
            this.createStartTaskGraphSubscription(this.startGraphStream, this.evaluateGraphStream)
        ];
    };

    TaskScheduler.prototype.isRunning = function() {
        return this.running;
    };

    TaskScheduler.prototype.createTaskHandlerStream = function(evaluateTaskStream) {
        var self = this;
        return evaluateTaskStream
        .filter(self.isRunning.bind(self))
        .tap(self.handleStreamDebug.bind(self, 'Received evaluate task event'))
        .flatMap(self.checkTaskStateHandledByGraph.bind(self))
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

    TaskScheduler.prototype.createReadyTaskStream = function(evaluateGraphStream) {
        var self = this;
        return evaluateGraphStream
        .filter(self.isRunning.bind(self))
        .tap(self.handleStreamDebug.bind(self, 'Received evaluate graph event'))
        .flatMap(self.findReadyTasks.bind(self))
        .share();
    };

    // graphId and evaluatedOnly are both optional
    TaskScheduler.prototype.findReadyTasks = function(data) {
        assert.object(data);
        var self = this;

        return Rx.Observable.just(data)
        .flatMap(function(_data) {
            return store.findReadyTasks(
                self.schedulerId, self.domain, _data.graphId, _data.evaluatedOnly);
        })
        .catch(self.handleStreamError.bind(self, 'Error finding ready tasks'));
    };

    TaskScheduler.prototype.createGraphFailSubscription = function(taskHandlerStream) {
        var self = this;
        return taskHandlerStream
        .filter(self.isRunning.bind(self))
        .filter(function(data) { return data.unhandledFailure; })
        .tap(self.handleStreamDebug.bind(self, 'Handling unhandled graph failure'))
        .flatMap(self.handleFailGraphEvent.bind(self))
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
        .filter(self.isRunning.bind(self))
        .filter(function(data) { return !data.unhandledFailure; })
        .flatMap(self.updateTaskDependencies.bind(self))
        .tap(self.handleStreamDebug.bind(self, 'Updated task dependencies'))
        .map(function(task) { return task.graphId; })
        .subscribe(
            function(graphId) {
                evaluateGraphStream.onNext({
                    graphId: graphId,
                    evaluatedOnly: false
                });
            },
            self.handleStreamError.bind(self, 'Error at update task dependencies stream')
        );
    };

    TaskScheduler.prototype.createTasksToScheduleSubscription = function(readyTaskStream) {
        var self = this;
        return readyTaskStream
        .filter(self.isRunning.bind(self))
        .filter(function(data) { return !_.isEmpty(data.tasks); })
        .map(function(data) { return data.tasks; })
        .flatMap(function(tasks) { return Rx.Observable.from(tasks); })
        .tap(self.handleStreamDebug.bind(self, 'Received schedule task event'))
        .flatMap(self.handleScheduleTaskEvent.bind(self))
        .subscribe(
            self.handleStreamSuccess.bind(self, 'Task scheduled'),
            self.handleStreamError.bind(self, 'Error at task scheduling stream')
        );
    };

    TaskScheduler.prototype.handleScheduleTaskEvent = function(data) {
        assert.object(data, 'task data object'); var self = this;

        return Rx.Observable.just(data)
        .flatMap(store.checkoutTaskForScheduler.bind(store, self.schedulerId, self.domain))
        // Don't schedule items we couldn't check out
        .filter(function(task) { return !_.isEmpty(task); })
        .flatMap(self.publishScheduleTaskEvent.bind(self))
        .catch(self.handleStreamError.bind(self, 'Error scheduling task'));
    };

    TaskScheduler.prototype.createStartTaskGraphSubscription =
        function(startGraphStream, evaluateGraphStream) {

        var self = this;
        return startGraphStream
        .filter(self.isRunning.bind(self))
        .flatMap(self.handleStartTaskGraphEvent.bind(self))
        .map(_.first)
        .subscribe(
            function(graphId) {
                evaluateGraphStream.onNext({
                    graphId: graphId,
                    evaluatedOnly: false
                });
            },
            this.handleStreamError.bind(this, 'Error at start taskgraph stream')
        );
    };

    TaskScheduler.prototype.handleStartTaskGraphEvent = function(data) {
        assert.object(data, 'graph data object');
        var self = this;

        return Rx.Observable.just(data)
        .flatMap(TaskGraph.create.bind(TaskGraph, self.domain))
        .flatMap(function(graph) {
            var async = [
                Rx.Observable.just(graph.instanceId),
                store.persistGraphObject(graph)
            ];
            var items = graph.createTaskDependencyItems().map(function(item) {
                return store.persistTaskDependencies(item, graph.instanceId);
            });
            return Rx.Observable.forkJoin(async.concat(items));
        })
        .catch(self.handleStreamError.bind(self, 'Error starting task graph'));
    };

    TaskScheduler.prototype.createGraphFinishedSubscription = function(readyTaskStream) {
        var self = this;

        return readyTaskStream
        .filter(self.isRunning.bind(self))
        .filter(function(data) { return _.isEmpty(data.tasks) || !data.graphId; })
        .flatMap(self.handleGraphFinishedEvent.bind(self))
        .tap(self.handleStreamDebug.bind(self, 'Handled graph finished event'))
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
        .flatMap(self.findPotentialFinishedGraphs.bind(self))
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
        return Rx.Observable.just()
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
        return taskMessenger.publishRunTask('default', data.taskId, data.graphId)
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
        .filter(self.isRunning.bind(self))
        .flatMap(self.findUnevaluatedTasks.bind(self))
        .flatMap(function(tasks) { return Rx.Observable.from(tasks); })
        .subscribe(
            evaluateTaskStream.onNext.bind(evaluateTaskStream),
            self.handleStreamError.bind(self, 'Error polling for tasks')
        );
    };

    TaskScheduler.prototype.createEvaluatedTaskPollerSubscription = function(evaluateGraphStream) {
        var self = this;

        return Rx.Observable.interval(self.pollInterval)
        .filter(self.isRunning.bind(self))
        .subscribe(
            evaluateGraphStream.onNext.bind(evaluateGraphStream,
                { graphId: null, evaluatedOnly: true }),
            self.handleStreamError.bind(self, 'Error polling for tasks')
        );
    };

    TaskScheduler.prototype.findUnevaluatedTasks = function() {
        var self = this;

        return Rx.Observable.just()
        .flatMap(store.findUnevaluatedTasks.bind(store, self.schedulerId, self.domain))
        .tap(function(tasks) {
            if (tasks && tasks.length) {
                logger.debug('Poller is triggering unevaluated tasks to be evaluated', {
                    tasks: _.map(tasks, function(task) { return task.taskId; }),
                });
            }
        });
    };

    // TODO: not implemented
    TaskScheduler.prototype.listen = function() {
        return Promise.resolve();
    };

    TaskScheduler.prototype.start = function() {
        var self = this;
        return Promise.resolve()
        .then(function() {
            self.running = true;
            self.pipelines = self.initializePipeline();
            return [self.listen(), self.subscribeTaskFinished()];
        })
        .spread(function() {
            logger.info('Task scheduler started', {
                schedulerId: self.schedulerId,
                domain: self.domain
            });
        })
        // TODO: remove test tap
        .tap(function() {
            self.test();
        });
    };

    TaskScheduler.prototype.test = function() {
        var testObj = { definition: {
            friendlyName: 'noop-graph',
            injectableName: 'Graph.noop-example',
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
        try {
            this.running = false;
            while (!_.isEmpty(this.pipelines)) {
                this.pipelines.pop().dispose();
            }
        } catch (e) {
            logger.error('Failed to stop task scheduler', {
                schedulerId: this.schedulerId,
                error: e
            });
        }
    };

    TaskScheduler.create = function() {
        return new TaskScheduler();
    };

    return TaskScheduler;
}
