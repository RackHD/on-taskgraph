// Copyright 2015, EMC, Inc.
'use strict';

var di = require('di');

module.exports = taskGraphFactory;
di.annotate(taskGraphFactory, new di.Provide('TaskGraph.TaskGraph'));
di.annotate(taskGraphFactory,
    new di.Inject(
        'Task.Task',
        'TaskGraph.Store',
        'Constants',
        'Assert',
        'uuid',
        'Promise',
        '_'
    )
);

function taskGraphFactory(
    Task,
    store,
    Constants,
    assert,
    uuid,
    Promise,
    _
) {
    function TaskGraph(definition, context) {
        this.definition = definition;

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

        this.tasks = {};

        // TODO: find instances of 'valid' elsewhere and replace from valid to Pending
        this._status = Constants.TaskStates.Pending;

        this.logContext = {
            graphInstance: this.instanceId,
            graphName: this.name
        };
        if (this.context.target) {
            this.logContext.id = this.context.target;
        }
        // For database ref linking
        this.node = {
            id: this.context.target || this.definition.options.nodeId
        };

        return this;
    }

    /*
     * Take the tasks definitions in this.definition.tasks, generate instanceIds
     * to use for each task, and then create new Task objects that reference
     * the instanceIds in their dependencies instead of user-created task labels.
     */
    // TODO: Replace this with a proper DFS traversal instead of iterating
    TaskGraph.prototype._populateTaskData = function() {
        var self = this;

        assert.arrayOfObject(self.definition.tasks);
        var idMap = _.transform(self.definition.tasks, function(result, v) {
            result[v.label] = uuid.v4();
        }, {});
        return Promise.map(self.definition.tasks, function(taskData) {
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
                return self.constructTaskObject(taskData.taskName, taskOverrides,
                        taskData.optionOverrides, taskData.label)
                .then(function(definition) {
                    self.tasks[definition.instanceId] = definition;
                });
            } else if (taskData.taskDefinition) {
                return self.constructInlineTaskObject(taskData.taskDefinition,
                    taskOverrides, taskData.optionOverrides, taskData.label)
                .then(function(definition) {
                    self.tasks[definition.instanceId] = definition;
                });
            }
        })
        .spread(function() {
            return self;
        });
    };

    TaskGraph.prototype.constructInlineTaskObject = function(_definition, taskOverrides,
           optionOverrides, label) {

        return this._buildTaskDefinition(_definition, optionOverrides,
                taskOverrides, label);
    };

    TaskGraph.prototype.constructTaskObject = function(taskName, taskOverrides,
           optionOverrides, label) {
        var self = this;
        return store.getTask(taskName)
        .then(function(taskDefinition) {
            return self._buildTaskDefinition(taskDefinition,
                    optionOverrides, taskOverrides, label);
        });
    };

    TaskGraph.prototype._parseWaitingOnState = function(val) {
        if (val.trim().indexOf(' ') < 0) {
            return [val];
        }
        /*
        var out = [];
        if (val.indexOf(' or ') > -1) {
            var states = val.split(' or ');
        }
        while (val.indexOf(' or ') > -1) {

        }
        if (val.indexOf(' and ') > -1) {
            return val.split(' and ');
        }
        */
    };

    TaskGraph.prototype._buildWaitingOn = function(waitingOn) {
        var self = this;
        return _.transform(waitingOn, function(results, v, k) {
            if (v.trim().indexOf(' ') > -1) {
                _.forEach(self._parseWaitingOnState(v), function(states) {
                    results.push({ task: k, states: states });
                });
            }
        }, []);
    };

    TaskGraph.prototype._buildTaskDefinition = function(_definition, optionOverrides,
            taskOverrides, label) {
        var self = this;
        var definition = _.cloneDeep(_definition);

        return self._getBaseTask(_definition)
        .then(function(baseTaskDefinition) {
            definition.instanceId = taskOverrides.instanceId;
            definition.properties = _.merge(definition.properties, baseTaskDefinition.properties);
            definition.runJob = baseTaskDefinition.runJob;
            definition.options = _.merge(definition.options || {}, optionOverrides || {});
            definition.name = taskOverrides.name || definition.injectableName;
            definition.waitingOn = taskOverrides.waitingOn || {};
            // TODO: Remove ignoreFailure in favor of better graph branching evalution.
            definition.ignoreFailure = taskOverrides.ignoreFailure || false;

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
        });
    };

    TaskGraph.prototype.validate = function () {
        var self = this;
        var context = {};

        return Promise.resolve()
        .then(function() {
            // TODO: Move this into the loop below so we don't iterate more than
            // necessary.
            self._validateTaskLabels();
        })
        .then(function() {
            return Promise.map(self.definition.tasks, function(taskData) {
                if (_.has(taskData, 'taskDefinition')) {
                    return taskData.taskDefinition;
                } else {
                    return store.getTask(taskData.taskName)
                    .then(function(taskDefinition) {
                        return Promise.all([
                            self._validateTaskDefinition(taskDefinition),
                            self._validateProperties(taskDefinition, context),
                            self._validateOptions(taskDefinition, taskData.label)
                        ]);
                    });
                }
            });
        })
        .spread(function() {
            return self;
        });
    };

    TaskGraph.prototype._validateTaskLabels = function() {
        _.transform(this.definition.tasks, function(result, task) {
            if (result[task.label]) {
                throw new Error(("The task label '%s' is used more than once in " +
                                "the graph definition.").format(task.label));
            } else {
                result[task.label] = true;
            }
        }, {});
    };

    TaskGraph.prototype._validateTaskDefinition = function(taskDefinition) {
        assert.object(taskDefinition, 'taskDefinition');
        assert.string(taskDefinition.friendlyName, 'friendlyName');
        assert.string(taskDefinition.injectableName, 'injectableName');
        assert.string(taskDefinition.implementsTask, 'implementsTask');
        assert.object(taskDefinition.options, 'options');
        assert.object(taskDefinition.properties, 'properties');

        return this._getBaseTask(taskDefinition)
        .then(function(baseTaskDefinition) {
            assert.string(baseTaskDefinition.friendlyName, 'friendlyName');
            assert.string(baseTaskDefinition.injectableName, 'injectableName');
            assert.string(baseTaskDefinition.runJob, 'runJob');
            assert.object(baseTaskDefinition.requiredOptions, 'requiredOptions');
            assert.object(baseTaskDefinition.requiredProperties, 'requiredProperties');
            assert.object(baseTaskDefinition.properties, 'properties');
        });
    };

    TaskGraph.prototype._validateProperties = function(taskDefinition, context) {
        var self = this;
        return self._getBaseTask(taskDefinition)
        .then(function(baseTaskDefinition) {
            var requiredProperties = baseTaskDefinition.requiredProperties;
            _.forEach(requiredProperties, function(v, k) {
                self.compareNestedProperties(
                    v, k, context.properties, baseTaskDefinition.injectableName);
            });

            // Update shared context with properties from this task
            var _properties = _.merge(taskDefinition.properties, baseTaskDefinition.properties);
        context.properties = _.merge(_properties, context.properties);
        });
    };

    TaskGraph.prototype._validateOptions = function(taskDefinition, label) {
        var self = this;
        return self._getBaseTask(taskDefinition)
        .then(function(baseTaskDefinition) {
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
        });
    };

    TaskGraph.prototype._getBaseTask = function(definition) {
        assert.object(definition);
        assert.string(definition.implementsTask);


        return store.getTask(definition.implementsTask)
        .then(function(baseTaskDefinition) {
            assert.object(baseTaskDefinition, "Base task definition for " +
                    definition.implementsTask + " should exist");
            return baseTaskDefinition;
        });
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

    TaskGraph.prototype.createTaskDependencyObject = function(task) {
        return _.transform(task.waitingOn, function(out, states, taskId) {
            var first = true;
            var initialSize = out.length;
            states.split(' or ').forEach(function(state) {
                if (!out.length) {
                    var depObj = {};
                    depObj[taskId] = state;
                    out.push(depObj);
                } else if (first) {
                    out.forEach(function(item) {
                        item[taskId] = state;
                    });
                } else {
                    // Ensure each dependency object represents a unique
                    // dependency path iteration, accounting for all
                    // possible dependency paths.
                    // For example, if state === 'a or b' then one dependency object
                    // will only include state 'a', and the other only state 'b'.
                    // This works with any number of 'or' items in any number of dependencies,
                    // and the number of unique dependency objects created is multiplicative.
                    var sliced = out.slice(out.length - initialSize, out.length);
                    sliced.forEach(function(item) {
                        var dep = _.transform(item, function(result, v, k) {
                            result[k] = k === taskId ? state : v;
                        }, {});
                        out.push(dep);
                    });

                }
                if (first) {
                    first = false;
                }
            });
        }, []);
    };

    TaskGraph.prototype.createTaskDependencyItems = function() {
        var self = this;
        return _.flatten(_.map(this.tasks, function(task) {
            if (_.isEmpty(task.waitingOn)) {
                return {
                    taskId: task.instanceId,
                    dependencies: {}
                };
            }
            return _.map(self.createTaskDependencyObject(task), function(dependencies) {
                return {
                    taskId: task.instanceId,
                    dependencies: dependencies
                };
            });
        }));
    };

    // enables JSON.stringify(this)
    TaskGraph.prototype.toJSON = function toJSON() {
        return this;
    };

    TaskGraph.create = function (data) {
        var definition = data.definition;
        var options = data.options;
        var context = data.context;
        // TODO: replace this with _.defaultsDeep when we upgrade to lodash 3 so
        // that we don't have to call cloneDeep, and so that definition.options
        // isn't a reference.
        var _definition = _.cloneDeep(definition);
        _definition.options = _.merge(definition.options || {}, options || {});
        var graph = new TaskGraph(_definition, context);
        return graph.validate()
        .then(function(graph) {
            return graph._populateTaskData();
        });
    };

    return TaskGraph;
}
