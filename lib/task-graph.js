// Copyright 2015, EMC, Inc.
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
        'Errors',
        'Constants',
        'Assert',
        'uuid',
        'Promise',
        '_',
        di.Injector
    )
);

function factory(Task, scheduler, registry, eventsProtocol, schedulerProtocol,
        Logger, Errors, Constants, assert, uuid, Promise, _, injector) {

    var TaskStates = Constants.TaskStates;
    var logger = Logger.initialize(factory);

    function TaskGraph(definition, context) {
        this.definition = _.cloneDeep(definition);
        if (this.definition.options && this.definition.options.instanceId) {
            this.instanceId = this.definition.options.instanceId;
        } else {
            this.instanceId = uuid.v4();
        }

        // Bool
        this.serviceGraph = this.definition.serviceGraph;
        this.context = context || {};
        this.context.graphId = this.instanceId;
        this.name = this.definition.friendlyName;
        this.injectableName = this.definition.injectableName;

        this.completeEventString = 'complete';

        this.subscriptions = {};
        this.cancelled = false;
        this.tasks = {};
        this.ready = [];
        this.finishedStates = [
            TaskStates.Failed,
            TaskStates.Succeeded,
            TaskStates.Timeout,
            TaskStates.Cancelled
        ];
        this.failedStates = [
            TaskStates.Failed,
            TaskStates.Timeout,
            TaskStates.Cancelled
        ];

        this._status = 'valid';

        this.logContext = {
            graphInstance: this.instanceId,
            graphName: this.name
        };
        if (this.context.target) {
            this.logContext.id = this.context.target;
        }
        logger.debug('Graph created', this.logContext);

        return this;
    }
    util.inherits(TaskGraph, events.EventEmitter);

    TaskGraph.prototype.pendingTasks = function() {
        return _.compact(_.map(this.tasks, function(task) {
            return task.state === TaskStates.Pending ? task : undefined;
        }));
    };

    TaskGraph.prototype.finishedTasks = function() {
        var finishedStates = this.finishedStates;
        return _.compact(_.map(this.tasks, function(task) {
            return _.contains(finishedStates, task.state) ? task : undefined;
        }));
    };

    TaskGraph.prototype.status = function() {
        return {
            instanceId: this.instanceId,
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
     * Take the tasks definitions in this.definition.tasks, generate instanceIds
     * to use for each task, and then create new Task objects that reference
     * the instanceIds in their dependencies instead of user-created task labels.
     */
    TaskGraph.prototype._populateTaskData = function() {
        var self = this;
        var taskInstance;

        self.constructDefinitionTemplateValues();

        assert.arrayOfObject(self.definition.tasks);
        var idMap = _.transform(self.definition.tasks, function(result, v) {
            result[v.label] = uuid.v4();
        }, {});
        _.forEach(self.definition.tasks, function(taskData) {
            assert.object(taskData);
            if (_.has(taskData, 'taskName')) {
                assert.string(taskData.taskName);
            } else if (_.has(taskData, 'taskDefinition')) {
                assert.object(taskData.taskDefinition);
            } else {
                throw new Error("All TaskGraph tasks should have either a taskName" +
                    " or taskDefinition property.");
            }

            _.forEach(_.keys(taskData.waitOn), function(waitOnTask) {
                var newWaitOnTaskKey = idMap[waitOnTask];
                assert.ok(newWaitOnTaskKey, 'Task to wait on does not exist: ' + waitOnTask);
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
                        taskData.optionOverrides, taskData.label);
            } else if (taskData.taskDefinition) {
                taskInstance = self.constructInlineTaskObject(taskData.taskDefinition,
                    taskOverrides, taskData.optionOverrides, taskData.label);
            }

            self.tasks[taskInstance.instanceId] = taskInstance;
        });
    };

    // Kind of a placeholder for now for graph templating/intelligence. Only supports UUID.
    TaskGraph.prototype.renderValue = function(value) {
        var prefix = '<%=';
        var suffix = '%>';
        if (value === prefix + 'uuid' + suffix) {
            return uuid.v4();
        }
    };

    // Kind of a placeholder for now for graph templating/intelligence.
    // Search this.definition.options at one and two key levels deep for template
    // strings, and render them before constructing task data.
    TaskGraph.prototype.constructDefinitionTemplateValues = function() {
        var self = this;
        var templateRegex = /<%=.*%>/;
        _.forEach(this.definition.options, function(v, k) {
            if (templateRegex.test(v)) {
                self.definition.options[k] = self.renderValue(v);
            }
            _.forEach(self.definition.options[k], function(_v, _k) {
                if (templateRegex.test(_v)) {
                    self.definition.options[k][_k] = self.renderValue(_v);
                }
            });
        });
    };

    TaskGraph.prototype.constructInlineTaskObject = function(_definition, taskOverrides,
           optionOverrides, label) {

        var definition = this._buildTaskDefinition(_definition, optionOverrides, label);

        return Task.createRegistryObject(_definition).create(definition, taskOverrides,
                this.context);
    };

    TaskGraph.prototype.constructTaskObject = function(taskName, taskOverrides,
           optionOverrides, label) {

        var taskRegistryObject = registry.fetchTaskSync(taskName);
        var createTask = taskRegistryObject.create;
        var definition = this._buildTaskDefinition(taskRegistryObject.definition,
                optionOverrides, label);

        return createTask(definition, taskOverrides, this.context);
    };

    TaskGraph.prototype._buildTaskDefinition = function(_definition, optionOverrides, label) {
        var self = this;
        var definition = _.cloneDeep(_definition);
        var baseTaskDefinition = self._getBaseTask(_definition);

        definition.properties = _.merge(definition.properties, baseTaskDefinition.properties);
        definition.runJob = baseTaskDefinition.runJob;
        definition.options = _.merge(definition.options || {}, optionOverrides || {});
        var allOptions = _.uniq(
                _.keys(definition.options).concat(baseTaskDefinition.requiredOptions));

        // If the graph has specifically defined options for a task, don't bother
        // with whether they exist as a required option or not in the base definition.
        if (_.has(self.definition.options, label)) {
            allOptions = allOptions.concat(_.keys(self.definition.options[label]));
        }

        if (!_.isEmpty(self.definition.options)) {
            _.forEach(allOptions, function(option) {
                var taskSpecificOptions = self.definition.options[label];
                if (_.has(taskSpecificOptions, option)) {
                    definition.options[option] = taskSpecificOptions[option];
                } else if (_.has(self.definition.options.defaults, option)) {
                    definition.options[option] = self.definition.options.defaults[option];
                }
            });
        }

        return definition;
    };

    TaskGraph.prototype._findReadyTasks = function () {
        var self = this;
        _.forEach(self.pendingTasks(), function(task) {
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

        self._validateTaskLabels();

        _.forEach(self.definition.tasks, function(taskData) {
            var taskDefinition;
            if (_.has(taskData, 'taskDefinition')) {
                taskDefinition = taskData.taskDefinition;
            } else {
                var taskObj = registry.fetchTaskSync(taskData.taskName);
                assert.object(taskObj, taskData.taskName);
                assert.object(taskObj.definition);
                taskDefinition = taskObj.definition;
            }

            self._validateTaskDefinition(taskDefinition);
            self._validateProperties(taskDefinition, context);
            self._validateOptions(taskDefinition, taskData.label);
            self._validateJob(taskDefinition);
        });
    };

    TaskGraph.prototype._validateTaskLabels = function() {
        var labels = _.transform(this.definition.tasks, function(result, task) {
            if (result[task.label]) {
                result[task.label] += 1;
            } else {
                result[task.label] = 1;
            }
        }, {});
        _.forEach(labels, function(label, key) {
            if (label > 1) {
                throw new Error(("The task label '%s' is used more than once in " +
                                "the graph definition.").format(key));
            }
        });
    };

    TaskGraph.prototype._validateTaskDefinition = function(taskDefinition) {
        assert.object(taskDefinition, 'taskDefinition');
        assert.string(taskDefinition.friendlyName, 'friendlyName');
        assert.string(taskDefinition.injectableName, 'injectableName');
        assert.string(taskDefinition.implementsTask, 'implementsTask');
        assert.object(taskDefinition.options, 'options');
        assert.object(taskDefinition.properties, 'properties');

        var baseTaskDefinition = this._getBaseTask(taskDefinition);

        assert.string(baseTaskDefinition.friendlyName, 'friendlyName');
        assert.string(baseTaskDefinition.injectableName, 'injectableName');
        assert.string(baseTaskDefinition.runJob, 'runJob');
        assert.object(baseTaskDefinition.requiredOptions, 'requiredOptions');
        assert.object(baseTaskDefinition.requiredProperties, 'requiredProperties');
        assert.object(baseTaskDefinition.properties, 'properties');
    };

    TaskGraph.prototype._validateProperties = function(taskDefinition, context) {
        var self = this;
        var baseTaskDefinition = self._getBaseTask(taskDefinition);

        var requiredProperties = baseTaskDefinition.requiredProperties;
        _.forEach(requiredProperties, function(v, k) {
            self.compareNestedProperties(
                v, k, context.properties, baseTaskDefinition.injectableName);
        });

        // Update shared context with properties from this task
        var _properties = _.merge(taskDefinition.properties, baseTaskDefinition.properties);
        context.properties = _.merge(_properties, context.properties);
    };

    TaskGraph.prototype._validateOptions = function(taskDefinition, label) {
        var self = this;
        var baseTaskDefinition = self._getBaseTask(taskDefinition);

        _.forEach(baseTaskDefinition.requiredOptions, function(k) {
            var option = taskDefinition.options[k];
            if (!option && _.has(self.definition.options.defaults, k)) {
                option = self.definition.options.defaults[k];
            }
            if (label && _.has(self.definition.options[label], k)) {
                option = self.definition.options[label][k];
            }
            assert.ok(option,
                'required option ' + k + ' for task ' +
                taskDefinition.injectableName + ' in graph ' + self.injectableName);
        });
    };

    TaskGraph.prototype._validateJob = function(taskDefinition) {
        var baseTaskDefinition = this._getBaseTask(taskDefinition);
        assert.ok(injector.get(baseTaskDefinition.runJob));
    };

    TaskGraph.prototype._getBaseTask = function(definition) {
        assert.object(definition);
        assert.string(definition.implementsTask);

        var baseTaskDefinition = registry.fetchBaseTaskDefinitionSync(definition.implementsTask);

        assert.object(baseTaskDefinition, "Base task definition for " +
                definition.implementsTask + " should exist");

        return baseTaskDefinition;
    };

    TaskGraph.prototype.compareNestedProperties = function(value, nestedKey, obj, taskName) {
        var self = this;

        // nested key is a dot notated string that represents a JSON scope, e.g.
        // os.linux.type represents { os: { linux: { type: 'value' } } }
        if (!nestedKey) {
            return;
        }
        assert.string(nestedKey);
        var keys = nestedKey.split('.');
        if (keys.length === 1) {
            assert.ok(_.has(obj, keys[0]),
                'expected property ' + keys[0] + ' to be supplied for task ' +
                taskName + ' in graph ' + self.injectableName);
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
                assert.ok(_.has(obj, accumulator),
                    'expected property ' + accumulator + ' to be supplied for task ' +
                    taskName + ' in graph ' + self.injectableName);
                nested = obj[accumulator];
            } else {
                // Subsequent passes, accumulator is an object
                assert.ok(_.has(accumulator, key),
                    'expected property ' + key + ' to be supplied for task ' +
                    taskName + ' in graph ' + self.injectableName);
                nested = accumulator;
            }

            // Last pass, check against the value now that we've reached
            // the correct scope.
            if (key === _.last(keys)) {
                assert.equal(nested[key], value,
                    'expected property ' + key + ' to equal ' + value + ' for task ' +
                    taskName + ' in graph ' + self.injectableName);
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
                taskInstance: task.instanceId,
                schedulerOverrides: task.options.schedulerOverrides
            });

            this._scheduleTask(task.instanceId, task.name, task.options.schedulerOverrides || {});
        }
    };

    TaskGraph.prototype._scheduleTask = function(taskId, taskName, schedulerOverrides) {
        var self = this;

        self._createTaskSubscription(taskId)
        .then(function() {
            schedulerProtocol.schedule(taskId, taskName, schedulerOverrides);
        })
        .catch(function(error) {
            logger.error("Error creating task subscription.", {
                error: error,
                taskId: taskId
            });
            self.stop(TaskStates.Failed);
        });
    };

    TaskGraph.prototype._checkDone = function() {
        var self = this;
        // If _checkDone is triggered more than once before this.stop() completes,
        // prevent a race condition where this.stop() is called multiple times.
        if (_.contains(self.finishedStates, self._status)) {
            return;
        }
        var finishedTaskCount = this.finishedTasks().length;
        var failedTask = _.find(self.tasks, function(task) {
            return _.contains(self.failedStates, task.state) && !task.ignoreFailure;
        });
        if (failedTask) {
            self._status = TaskStates.Failed;
            logger.warning("Task failure, stopping TaskGraph and remaining tasks/jobs.",
                    _.defaults({ taskError: failedTask.error }, this.logContext));
            self.stop(TaskStates.Failed);
            return true;
        } else if (finishedTaskCount === _.keys(this.tasks).length) {
            self._status = TaskStates.Succeeded;
            self.stop(TaskStates.Succeeded);
            return true;
        }
        return false;
    };

    TaskGraph.prototype.taskFinishedCallback = function taskFinishedCallback(taskId) {
        var self = this;

        var serialized = self.serialize();

        self.removeSubscription(taskId);
        self.persist()
        .catch(function(error) {
            logger.error("Error persisting Task Graph state", {
                error: error,
                graphInstance: self.instanceId,
                graphName: self.name,
                graph: serialized
            });
        });

        var done = self._checkDone();
        if (!done) {
            self._scheduleReadytasks();
        }
    };

    TaskGraph.prototype._createTaskSubscription = function(taskId) {
        var self = this;
        return eventsProtocol.subscribeTaskFinished(
            taskId, function() {
                self.taskFinishedCallback.call(self, taskId);
            }
        ).then(function(subscription) {
            self.subscriptions[taskId] = subscription;
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
        self._status = state || TaskStates.Cancelled;
        _.forEach(this.tasks, function(task) {
            if (!_.contains(self.finishedStates, task.state)) {
                task.cancel(new Errors.TaskCancellationError(
                        'Cancelled by taskgraph with state ' + self._status));
            }
        });
        return Promise.all(_.map(this.subscriptions, function(subscription) {
            return subscription.dispose();
        }))
        .then(function() {
            return self.persist();
        })
        .then(function() {
            return eventsProtocol.publishGraphFinished(self.instanceId, self._status);
        })
        .then(function() {
            self.emit(self.completeEventString);
        })
        .catch(function(error) {
            logger.error("Error canceling task graph.", {
                error: error,
                graphId: self.instanceId,
                graphName: self.name
            });
        });
    };

    TaskGraph.prototype.startTaskListeners = function() {
        return Promise.all(_.map(this.tasks, function(task) {
            return task.start();
        }));
    };

    TaskGraph.prototype.start = function () {
        var self = this;

        return Promise.resolve()
        .then(function() {
            self.validate();
            self._populateTaskData();
            return self.persist();
        })
        .then(function (record) {
            return [record, self.startTaskListeners()];
        })
        .spread(function(record) {
            self._scheduleReadytasks();
            return record;
        })
        .tap(function() {
            return eventsProtocol.publishGraphStarted(self.instanceId);
        })
        .catch(function(error) {
            logger.error("Error starting task graph.", {
                error: error,
                graphId: self.instanceId,
                graphName: self.name
            });
            self.stop(TaskStates.Failed);
            throw new Error("Error starting task graph: " + error.toString());
        });
    };

    TaskGraph.prototype.stop = function(state) {
        var self = this;

        logger.debug("Stopping TaskGraph.", _.defaults({ state: state }, this.logContext));

        return this.cancel(state)
        .catch(function(error) {
            logger.error("Error stopping task graph.", {
                error: error,
                graphId: self.instanceId,
                graphName: self.name
            });
            throw error;
        });
    };

    // enables JSON.stringify(this)
    TaskGraph.prototype.toJSON = function toJSON() {
        return this.serialize();
    };

    TaskGraph.prototype.serialize = function serialize() {
        var self = this;

        var obj = _.transform(this, function(result, v, k) {
            if (k !== 'tasks' && k !== 'subscriptions' && k !== '_events') {
                result[k] = v;
            }
        }, {});

        obj.tasks = _.transform(self.tasks, function(result, task) {
            result[task.instanceId] = task.serialize();
        }, {});

        obj.pendingTasks = _.map(self.pendingTasks(), function(task) {
            return obj.tasks[task.instanceId];
        });

        obj.finishedTasks =_.map(self.finishedTasks(), function(task) {
            return obj.tasks[task.instanceId];
        });

        obj.node = {
            id: this.context.target || this.definition.options.nodeId
        };

        return obj;
    };

    TaskGraph.prototype.persist = function persist() {
        return registry.persistGraphObject(this.instanceId, this.serialize());
    };

    TaskGraph.create = function (definition, context) {
        return new TaskGraph(definition, context);
    };

    TaskGraph.createRegistryObject = function (definition) {
        var _definition = _.cloneDeep(definition);
        return {
            create: function(optionOverrides, context) {
                var _definition = _.cloneDeep(definition);
                _definition.options = _.merge(_definition.options || {}, optionOverrides || {});
                return TaskGraph.create(_definition, context);
            },
            definition: _definition
        };
    };

    return TaskGraph;
}
