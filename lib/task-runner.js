// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di');
module.exports = taskRunnerFactory;
di.annotate(taskRunnerFactory, new di.Provide('TaskGraph.TaskRunner'));
di.annotate(taskRunnerFactory,
    new di.Inject(
        'Logger',
        'Promise',
        'Constants',
        'Assert',
        'uuid',
        '_',
        'Rx',
        'Task.Task',
        'Task.Messenger',
        'TaskGraph.Store'
    )
);

function taskRunnerFactory(
    Logger,
    Promise,
    Constants,
    assert,
    uuid,
    _,
    Rx,
    Task,
    taskMessenger,
    store
) {
    var logger = Logger.initialize(taskRunnerFactory);

    function TaskRunner(options) {
        options = options || {};
        this.taskRunnerId = uuid.v4();
        this.runTaskStream = new Rx.Subject();
        this.pipelines = null;
        this.heartbeatInterval = options.heartbeatInterval || 2000;
        this.running = false;
        this.activeTasks = {};
        this.domain = options.domain || Constants.DefaultTaskDomain;
    }

    TaskRunner.prototype.isRunning = function() {
        return this.running;
    };

    TaskRunner.prototype.initializePipeline = function() {
        var self = this;
        var runTaskSubscription = self.createRunTaskSubscription(self.runTaskStream);
        var heartbeatSubscription = self.createHeartbeatSubscription();

        return [
            runTaskSubscription,
            heartbeatSubscription
        ];
    };

    TaskRunner.prototype.subscribeRunTask = function() {
        return taskMessenger.subscribeRunTask(
                this.domain,
                this.runTaskStream.onNext.bind(this.runTaskStream)
            );
    };

    TaskRunner.prototype.createRunTaskSubscription = function(runTaskStream) {
        var self = this;
        return runTaskStream
            .takeWhile(self.isRunning.bind(self))
            .flatMap(store.checkoutTaskForRunner.bind(store, self.taskRunnerId))
            .filter(function(task) { return !_.isEmpty(task); })
            .flatMap(store.getTaskById.bind(store))
            .flatMap(self.runTask.bind(self))
            .subscribe(
                self.handleStreamSuccess.bind(self, 'Task finished'),
                self.handleStreamError.bind(self, 'Task failure')
            );
    };

    TaskRunner.prototype.createHeartbeatSubscription = function() {
        var self = this;
        return Rx.Observable.interval(self.heartbeatInterval)
                .takeWhile(self.isRunning.bind(self))
                .flatMap(store.heartbeatTasks.bind(self, self.taskRunnerId))
                .catch(function(error) {
                    logger.error('Failed to update heartbeat, stopping task runner and tasks', {
                        taskRunnerId: self.taskRunnerId,
                        error: error,
                        activeTasks: _.keys(self.activeTasks)
                    });
                    // TODO: probably better as fromPromise
                    return Rx.Observable.just(self.stop.bind(self)());
                })
                .subscribe(
                    self.handleStreamSuccess.bind(self, null),
                    self.handleStreamError.bind(self, 'Error handling heartbeat failure')
                );
    };

    TaskRunner.prototype.handleStreamSuccess = function(msg, data) {
        if (msg) {
            if (data && !data.taskRunnerId) {
                data.taskRunnerId = this.taskRunnerId;
            }
            logger.debug(msg, data);
        }
        return Rx.Observable.empty();
    };

    TaskRunner.prototype.handleStreamError = function(msg, err) {
        logger.error(msg, {
            taskRunnerId: this.taskRunnerId,
            // stacks on some error objects don't get printed if part of
            // the error object so separate them out here
            error: _.omit(err, 'stack'),
            stack: err.stack
        });
        return Rx.Observable.empty();
    };

    TaskRunner.prototype.runTask = function(data) {
        var self = this;
        return Rx.Observable.just(data)
            .map(function(_data) {
                return Task.create(
                    _data.task,
                    { instanceId: _data.task.instanceId },
                    _data.context
                );
            })
            .tap(function(task) {
                self.activeTasks[task.instanceId] = task;
            })
            .tap(function(task) {
                logger.debug("Running task ", {
                    taskRunnerId: self.taskRunnerId,
                    taskId: task.instanceId,
                    taskName: task.definition.injectableName
                });
            })
            .flatMap(function(task) {
                return task.run();
            })
            .flatMap(function(task) {
                return Rx.Observable.forkJoin([
                    Rx.Observable.just(task),
                    store.setTaskState(task.instanceId, task.context.graphId, task.state)
                ]);
            })
            .map(_.first)
            .tap(self.publishTaskFinished.bind(self))
            .map(function(task) { return _.pick(task, ['instanceId', 'state']); })
            .finally(function() {
                delete self.activeTasks[data.task.instanceId];
            });
    };

    TaskRunner.prototype.publishTaskFinished = function(task) {
        return taskMessenger.publishTaskFinished(
            this.domain, task.instanceId, task.context.graphId, task.state
        )
        .catch(function(error) {
            logger.error('Error publishing task finished event', {
                taskId: task.instanceId,
                graphId: task.context.graphId,
                state: task.state,
                error: error
            });
        });
    };

    TaskRunner.prototype.stop = function() {
        try {
            this.running = false;
            while (!_.isEmpty(this.pipelines)) {
                this.pipelines.pop().dispose();
            }
        } catch (e) {
            logger.error('Failed to stop task runner', {
                taskRunnerId: this.taskRunnerId,
                error: e
            });
        }
    };

    TaskRunner.prototype.start = function() {
        var self = this;
        return Promise.resolve()
        .then(function() {
            self.running = true;
            self.pipelines = self.initializePipeline();
            return self.subscribeRunTask();
        });
    };

    TaskRunner.create = function() {
        return new TaskRunner();
    };

    return TaskRunner;
}
