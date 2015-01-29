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
        '_',
        di.Injector
    )
);

function factory(Task, scheduler, registry, eventsProtocol, schedulerProtocol,
        Logger, assert, uuid, Q, _, injector) {
    var logger = Logger.initialize(factory);

    function TaskGraph(definition, context) {
        if (!(this instanceof TaskGraph)) {
            return new TaskGraph(definition);
        }

        var optionDefaults = {
            name: 'Default Task Graph Name',
            loggingLevel: 'silly',
            states: {
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
        this.options = _.merge(optionDefaults, definition || {});
        this.context = context || {};
        this.name = this.options.friendlyName;

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

        logger.debug('Graph created', {
            graphInstance: this.instanceId,
            graphName: this.name
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
        var taskInstance;

        assert.arrayOfObject(this.options.tasks);
        var idMap = _.transform(this.options.tasks, function(result, v) {
            result[v.label] = uuid.v4();
        }, {});
        _.forEach(this.options.tasks, function(taskData) {
            assert.object(taskData);
            if (_.has(taskData, 'taskName')) {
                assert.string(taskData.taskName);
            } else if (_.has(taskData, 'taskDefinition')) {
                assert.object(taskData.taskDefinition);
            } else {
                throw new Error("All TaskGraph tasks should have either a taskName" +
                    " or taskDefinition property.");
            }
            if (_.has(taskData, 'optionOverrides')) {
                assert.object(taskData.optionOverrides);
            }
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
            if (taskData.taskName) {
                taskInstance = self.constructTaskObject(taskData.taskName, taskOverrides,
                        taskData.optionOverrides);
            } else if (taskData.taskDefinition) {
                taskInstance = self.constructInlineTaskObject(taskData.taskDefinition,
                    taskOverrides, taskData.optionOverrides);
            }
            self.tasks[taskInstance.instanceId] = taskInstance;
        });
    };

    TaskGraph.prototype.constructInlineTaskObject = function(_definition, taskOverrides,
            optionOverrides) {
        var definition = _.cloneDeep(_definition);
        var baseTaskDefinition = this._getBaseTask(definition);

        definition.properties = _.merge(definition.properties, baseTaskDefinition.properties);
        definition.runJob = baseTaskDefinition.runJob;
        definition = _.merge(definition, optionOverrides);

        return Task.createRegistryObject(_definition).create(definition, taskOverrides,
                this.context);
    };

    TaskGraph.prototype.constructTaskObject = function(taskName, taskOverrides, optionOverrides) {
        var taskRegistryObject = registry.fetchTask(taskName);
        var createTask = taskRegistryObject.create;
        var definition = _.cloneDeep(taskRegistryObject.definition);
        var baseTaskDefinition = this._getBaseTask(definition);

        definition.properties = _.merge(definition.properties, baseTaskDefinition.properties);
        definition.runJob = baseTaskDefinition.runJob;
        definition.options = _.merge(definition.options, optionOverrides || {});

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
        var self = this;
        var context = {};
        _.forEach(self.options.tasks, function(taskData) {
            var taskName = taskData.taskName;
            var task = registry.fetchTask(taskName).definition;

            self._validateTaskDefinition(task);
            self._validateProperties(task, context);
            self._validateOptions(task);
            self._validateJob(task);
        });
    };

    TaskGraph.prototype._validateTaskDefinition = function(taskDefinition) {
        assert.object(taskDefinition);
        assert.string(taskDefinition.friendlyName);
        assert.string(taskDefinition.injectableName);
        assert.string(taskDefinition.implementsTask);
        assert.object(taskDefinition.options);
        assert.object(taskDefinition.properties);

        var baseTask = this._getBaseTask(taskDefinition);

        assert.string(baseTask.friendlyName);
        assert.string(baseTask.injectableName);
        assert.string(baseTask.runJob);
        assert.object(baseTask.requiredOptions);
        assert.object(baseTask.requiredProperties);
        assert.object(baseTask.properties);
    };

    TaskGraph.prototype._validateProperties = function(taskDefinition, context) {
        var self = this;
        var baseTask = self._getBaseTask(taskDefinition);
        var requiredProperties = baseTask.requiredProperties;
        _.forEach(requiredProperties, function(v, k) {
            self.compareNestedValue(v, k, context.properties);
        });

        // Update shared context with properties from this task
        var _properties = _.merge(taskDefinition.properties, baseTask.properties);
        context.properties = _.merge(_properties, context.properties);
    };

    TaskGraph.prototype._validateOptions = function(taskDefinition) {
        var baseTask = this._getBaseTask(taskDefinition);
        _.forEach(baseTask.requiredOptions, function(k) {
            assert.ok(_.has(taskDefinition.options, k));
        });
    };

    TaskGraph.prototype._validateJob = function(taskDefinition) {
        var baseTask = this._getBaseTask(taskDefinition);
        assert.ok(injector.get(baseTask.runJob));
    };

    TaskGraph.prototype._getBaseTask = function(definition) {
        assert.object(definition);
        assert.string(definition.implementsTask);

        var baseTaskObject = registry.fetchTask(definition.implementsTask);
        assert.object(baseTaskObject, "Base task object for " +
                definition.implementsTask + " should exist");
        assert.object(baseTaskObject.definition, "Base task definition for " +
                definition.implementsTask + " should exist");
        var baseTaskDefinition = baseTaskObject.definition;
        return baseTaskDefinition;
    };

    TaskGraph.prototype.compareNestedValue = function(value, nestedKey, obj) {
        // nested key is a dot notated string that represents a JSON scope, e.g.
        // os.linux.type represents { os: { linux: { type: 'value' } } }
        if (!nestedKey) {
            return;
        }
        assert.string(nestedKey);
        var keys = nestedKey.split('.');
        if (keys.length === 1) {
            assert.ok(_.has(obj, keys[0]));
            assert.equal(obj[keys[0]], value);
            return;
        }

        // Accumulator is a progressively nesting scope into an object, e.g.
        // 1. accumulator = key1  <- reduce makes accumulator the first item, which is a string
        // 2. accumulator = obj.key1.key2.key3  <- now accumulator is the object we returned
        // 3. accumulator = obj.key1.key2.key3.key4
        _.reduce(keys, function(accumulator, key) {
            var nested;

            if (typeof accumulator === 'string') {
                // First pass, accumulator is key[0]
                assert.ok(_.has(obj, accumulator));
                nested = obj[accumulator];
            } else {
                // Subsequent passes, accumulator is an object
                assert.ok(_.has(accumulator, key));
                nested = accumulator;
            }

            // Last pass, check against the value now that we've reached
            // the correct scope.
            if (key === _.last(keys)) {
                assert.equal(nested[key], value);
            }

            // Return next nested scope
            return nested[key];
        });
    };

    TaskGraph.prototype._scheduleReadytasks = function() {
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

    TaskGraph.prototype._checkDone = function() {
        var self = this;
        var failed = _.some(self.tasks, function(task) {
            return _.contains(self.failedStates, task.state) && !task.ignoreFailure;
        });
        if (failed) {
            this._status = 'failed';
            logger.info("Task failure, stopping TaskGraph and remaining tasks/jobs.", {
                graphInstance: self.instanceId
            });
            this.stop('failed');
            return true;
        } else {
            if (this.finishedTasks.length === _.keys(this.tasks).length) {
                this.stop('succeeded');
                return true;
            }
        }
        return false;
    };

    TaskGraph.prototype._createTaskSubscription = function(taskId) {
        var self = this;
        eventsProtocol.subscribeTaskFinished(
            taskId,
            function() {
                self.removeSubscription(taskId);
                var done = self._checkDone();
                if (!done) {
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
        // assert.ok(this.subscriptions[taskId], 'Task subscription for ' + taskId);

        if (!self.subscriptions[taskId]) {
            return;
        }
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
        var self = this;
        this._status = state || 'cancelled';
        _.forEach(this.tasks, function(task) {
            if (!_.contains(self.finishedStates, task.state)) {
                task.cancel();
            }
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
        logger.debug("Stopping TaskGraph.", {
            state: state,
            graphName: this.name,
            graphInstance: this.instanceId
        });
        return this.cancel(state);
    };

    TaskGraph.create = function (definition, context) {
        return new TaskGraph(definition, context);
    };

    TaskGraph.createRegistryObject = function (definition) {
        var _definition = _.cloneDeep(definition);
        return {
            create: function(optionOverrides, context) {
                var _definition = _.cloneDeep(definition);
                var options = _.merge(_definition, optionOverrides);
                return TaskGraph.create(options, context);
            },
            definition: Object.freeze(_definition)
        };
    };

    return TaskGraph;
}
