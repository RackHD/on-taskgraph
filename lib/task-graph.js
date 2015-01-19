// Copyright 2014, Renasar Technologies Inc.
/* jshint: node:true */
'use strict';

var di = require('di'),
    util = require('util'),
    events = require('events');

module.exports = factory;
di.annotate(factory, new di.Provide('TaskGraph.TaskGraph'));
di.annotate(factory,
    new di.Inject(
        'Task.Task',
        'TaskGraph.Scheduler',
        'TaskGraph.Registry',
        'Protocol.Events',
        'Protocol.Scheduler',
        'Logger',
        'Assert',
        'uuid',
        'Q',
        '_'
    )
);

function factory(Task, scheduler, registry, eventsProtocol, schedulerProtocol,
        Logger, assert, uuid, Q, _) {
    var logger = Logger.initialize(factory);

    function TaskGraph(definition, context) {
        if (!(this instanceof TaskGraph)) {
            return new TaskGraph(definition);
        }

        var optionDefaults = {
            name: 'Default Task Graph Name',
            loggingLevel: 'silly',
            states:{
                valid          : ['valid'],
                invalid        : ['invalid'],
                running        : ['running'],
                consumable     : ['observable', 'promised'],
                finalSuccess   : ['success'],
                finalFailure   : ['fail', 'invalid']
                }

        };

        this.instanceId = uuid.v4();

        this.definition = Object.freeze(_.cloneDeep(definition));
        this.options = _.defaults(definition || {}, optionDefaults);
        this.context = context || {};
        this.name = this.options.friendlyName;

        logger.log(this.options.loggingLevel, 'Graph created');

        this.completeEventString = 'complete';

        this.subscriptions = {};
        this.cancelled = false;
        this.nodes = {};
        this.tasks = {};
        this.ready = [];
        this.finishedStates = ['failed', 'succeeded', 'timeout', 'cancelled'];
        this.failedStates = ['failed', 'timeout', 'cancelled'];

        this._nodesNotReadyToRun = {};
        this._nodesReadyToRun = [];
        this._nodesCompleted = [];

        this._status = 'valid';

        this.tags = [];
        this.heartbeatTimer = null;

        this.stats = {
            totalNodes: 0,
            totalEdges: 0,
            cycleDetected: false,
            longestChain: 0,
            mostDependents: 0,
        };

        Object.defineProperty(this, 'pendingTasks', {
            get: function() {
                return _.compact(_.map(this.tasks, function(task) {
                    return task.state === 'pending' ? task : undefined;
                }));
            }
        });

        Object.defineProperty(this, 'finishedTasks', {
            get: function() {
                var self = this;
                return _.compact(_.map(this.tasks, function(task) {
                    return _.contains(self.finishedStates, task.state) ? task : undefined;
                }));
            }
        });

        return this;
    }
    util.inherits(TaskGraph, events.EventEmitter);

    TaskGraph.prototype.status = function() {
        return {
            status: this._status,
            tasks: _.transform(this.tasks, function(result, task) {
                result[task.instanceId] = {
                    state: task.state,
                    name: task.friendlyName
                };
            }, {})
        };
    };

    /*
     * Take the tasks definitions in this.options.tasks, generate instanceIds
     * to use for each task, and then create new Task objects that reference
     * the instanceIds in their dependencies instead of user-created task labels.
     */
    TaskGraph.prototype._populateTaskData = function() {
        var self = this;
        assert.arrayOfObject(this.options.tasks);
        var idMap = _.transform(this.options.tasks, function(result, v) {
            result[v.label] = uuid.v4();
        }, {});
        _.forEach(this.options.tasks, function(taskData) {
            assert.object(taskData);
            assert.string(taskData.taskName);
            _.forEach(_.keys(taskData.waitOn), function(waitOnTask) {
                var newWaitOnTaskKey = idMap[waitOnTask];
                assert.ok(newWaitOnTaskKey);
                var waitOnTaskValue = taskData.waitOn[waitOnTask];
                delete taskData.waitOn[waitOnTask];
                taskData.waitOn[newWaitOnTaskKey] = waitOnTaskValue;
            });
            var taskOverrides = {
                instanceId: idMap[taskData.label],
                waitingOn: taskData.waitOn,
                ignoreFailure: taskData.ignoreFailure
            };
            var taskInstance = self.constructTaskObject(taskData.taskName, taskOverrides);
            self.tasks[taskInstance.instanceId] = taskInstance;
        });
    };

    TaskGraph.prototype.constructTaskObject = function(taskName, taskOverrides) {
        var taskRegistryObject = registry.fetchTask(taskName);
        var createTask = taskRegistryObject.create;
        var definition = _.cloneDeep(taskRegistryObject.definition);
        assert.string(definition.implementsTask, 'Task definition implementsTask');

        var baseTaskObject = registry.fetchTask(definition.implementsTask);
        assert.object(baseTaskObject, "Base task object for " +
                definition.implementsTask + " should exist");
        assert.object(baseTaskObject.definition, "Base task definition for " +
                definition.implementsTask + " should exist");
        var baseTaskDefinition = baseTaskObject.definition;

        definition.properties = _.merge(definition.properties, baseTaskDefinition.properties);
        definition.runJob = baseTaskDefinition.runJob;

        return createTask(definition, taskOverrides, this.context);
    };

    TaskGraph.prototype.startTaskListeners = function() {
        return Q.all(_.map(this.tasks, function(task) {
            return task.start();
        }));
    };

    TaskGraph.prototype._findReadyTasks = function () {
        var self = this;
        _.forEach(self.pendingTasks, function(task) {
            var ready = _.isEmpty(task.waitingOn);
            ready = ready || _.every(task.waitingOn, function(desiredState, _taskId) {
                assert.ok(self.tasks[_taskId]);
                // TODO: support multiple desiredState keywords here, e.g.
                // 'finished' represents all possible finish states such as
                // succeeded, failed, timeout, etc.
                if (desiredState === 'finished') {
                    return _.contains(self.finishedStates, self.tasks[_taskId].state);
                }
                return self.tasks[_taskId].state === desiredState;
            });
            if (ready) {
                self.ready.push(task);
            }
        });
    };

    TaskGraph.prototype.validate = function () {
        logger.warning("TASK GRAPH VALIDATION NOT IMPLEMENTED");
    };

    TaskGraph.prototype._scheduleReadytasks = function() {
        if (this.finishedTasks.length === _.keys(this.tasks).length) {
            this.complete();
            return;
        }
        this._findReadyTasks();
        while (this.ready.length > 0) {
            var task = this.ready.shift();

            logger.debug("Scheduling task", {
                graphInstance: this.instanceId,
                taskName: task.name,
                taskInstance: task.instanceId
            });

            this._scheduleTask(task.instanceId, task.name);
        }
    };

    TaskGraph.prototype._scheduleTask = function(taskId, taskName) {
        this._createTaskSubscription(taskId);
        schedulerProtocol.schedule(taskId, taskName);
    };

    TaskGraph.prototype._checkStatus = function() {
        var self = this;
        var failed = _.some(self.tasks, function(task) {
            return _.contains(self.failedStates, task.state) && !task.ignoreFailure;
        });
        if (failed) {
            this._status = 'failed';
            logger.info("Task failure, stopping TaskGraph and remaining tasks/jobs.", {
                graphInstance: self.instanceId
            });
            this.stop();
        }
        return failed;
    };

    TaskGraph.prototype._createTaskSubscription = function(taskId) {
        var self = this;
        eventsProtocol.subscribeTaskFinished(
            taskId,
            function() {
                self.removeSubscription(taskId);
                var failed = self._checkStatus();
                if (!failed) {
                    self._scheduleReadytasks();
                }
            }
        ).then(function(subscription) {
            self.subscriptions[taskId] = subscription;
        })
        .catch(function(error) {
            logger.error("Error creating task subscription.", {
                error: error,
                taskId: taskId
            });
        });
    };

    TaskGraph.prototype.removeSubscription = function(taskId) {
        var self = this;
        assert.ok(this.subscriptions[taskId], 'Task subscription for ' + taskId);

        self.subscriptions[taskId].dispose().then(function() {
            delete self.subscriptions[taskId];
        }).catch(function(error) {
            logger.error("Error disposing of TaskGraph subscription.", {
                error: error,
                subscription: self.subscriptions[taskId]
            });
        });
    };

    TaskGraph.prototype.cancel = function(state) {
        this.state = state || 'cancelled';
        _.forEach(this.tasks, function(task) {
            task.cancel();
        });
        this.emit(this.completeEventString);
        return Q.all(_.map(this.subscriptions, function(subscription) {
            return subscription.dispose();
        }));
    };

    TaskGraph.prototype.start = function () {
        var self = this;
        try {
            self.validate();
            self._populateTaskData();
        } catch (e) {
            logger.error("Error starting task graph.", {
                error: e,
                graphId: self.instanceId,
                graphName: self.name
            });
            self.stop('failed');
            throw e;
        }
        self.startTaskListeners().then(function() {
            self._scheduleReadytasks();
        }).catch(function(error) {
            logger.error("Error starting task graph.", {
                error: error,
                graphId: self.instanceId,
                graphName: self.name
            });
            self.stop();
        });
    };

    TaskGraph.prototype.stop = function(state) {
        return this.cancel(state);
    };

    TaskGraph.prototype.complete = function() {
        this._status = 'complete';
        this.emit(this.completeEventString);
    };

    TaskGraph.create = function (definition, context) {
        return new TaskGraph(definition, context);
    };

    TaskGraph.createRegistryObject = function (definition) {
        var _definition = _.cloneDeep(definition);
        return {
            create: function(optionOverrides, context) {
                var _definition = _.cloneDeep(definition);
                var options = _.defaults(_definition, optionOverrides);
                return TaskGraph.create(options, context);
            },
            definition: Object.freeze(_definition)
        };
    };

    return TaskGraph;
}
