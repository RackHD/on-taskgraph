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
        'Logger',
        'Assert',
        'uuid',
        'Q',
        '_'
    )
);

function factory(Task, scheduler, registry, Logger, assert, uuid, Q, _) {
    var logger = Logger.initialize(factory);

    function TaskGraph(definition) {
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

        this.definition = Object.freeze(_.cloneDeep(definition));
        this.options = _.defaults(definition || {}, optionDefaults);

        logger.log(this.options.loggingLevel, 'Graph created');

        this.cancelled = false;
        this.nodes = {};
        this.tasks = {};
        this.ready = [];
        this.finishedOutcomes = ['failed', 'succeeded'];

        this._nodesNotReadyToRun = {};
        this._nodesReadyToRun = [];
        this._nodesCompleted = [];

        this._completeDeferred = Q.defer();
        this.completed = this._completeDeferred.promise;

        this.status = 'valid';

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
                    return task.outcome === 'pending' ? task : undefined;
                }));
            }
        });

        return this;
    }
    util.inherits(TaskGraph, events.EventEmitter);

    /*
     * Take the tasks definitions in this.options.tasks, generate instanceIds
     * to use for each task, and then create new Task objects that reference
     * the instanceIds in their dependencies instead of user-created task labels.
     */
    TaskGraph.prototype._populateTaskDependencies = function() {
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
                waitingOn: taskData.waitOn
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

        var baseTaskDefinition = registry.fetchTask(definition.implementsTask).definition;
        assert.object(baseTaskDefinition);

        definition.properties = _.merge(definition.properties, baseTaskDefinition.properties);
        definition.runJob = baseTaskDefinition.runJob;

        return createTask(definition, taskOverrides);
    };

    TaskGraph.prototype._findReadyTasks = function () {
        var self = this;
        _.forEach(self.pendingTasks, function(task) {
            var ready = _.isEmpty(task.waitingOn);
            ready = ready || _.every(task.waitingOn, function(desiredState, _taskId) {
                assert.ok(self.tasks[_taskId]);
                if (desiredState === 'finished') {
                    return _.contains(self.finishedOutcomes, self.tasks[_taskId].outcome);
                }
                return self.tasks[_taskId].outcome === desiredState;
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
        this._findReadyTasks();
        while (this.ready.length > 0) {
            scheduler.schedule(this.ready.shift());
        }
    };

    TaskGraph.prototype.start = function () {
        this.validate();
        this._populateTaskDependencies();

        this.on('workItemCompleted', function() {
            debugger;
            this._completeDeferred.resolve();
        });

        this._scheduleReadytasks();
    };

    TaskGraph.create = function (definition) {
        return new TaskGraph(definition);
    };

    TaskGraph.createRegistryObject = function (definition) {
        var _definition = _.cloneDeep(definition);
        return {
            create: function(optionOverrides) {
                var _definition = _.cloneDeep(definition);
                var options = _.defaults(_definition, optionOverrides);
                return TaskGraph.create(options);
            },
            definition: Object.freeze(_definition)
        };
    };

    return TaskGraph;
}
