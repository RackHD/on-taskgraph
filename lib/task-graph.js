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

        this.definition = definition;
        this.options = _.defaults(definition || {}, optionDefaults);

        logger.log(this.options.loggingLevel, 'Graph created');

        this.cancelled = false;
        this.nodes = {};
        this.tasks = {};
        this.ready = [];

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

        return this;
    }
    util.inherits(TaskGraph, events.EventEmitter);

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

    TaskGraph.prototype.validate = function () {
        logger.warning("TASK GRAPH VALIDATION NOT IMPLEMENTED");
    };

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
            var taskFactory = registry.fetchTask(taskData.taskName);
            var taskInstance = taskFactory.create(taskData, taskOverrides);
            self.tasks[taskInstance.instanceId] = taskInstance;
        });
    };

    TaskGraph.prototype.start = function () {
        this.validate();
        this._populateTaskDependencies();
        this._findReadyTasks();
        while (this.ready.length > 0) {
            scheduler.schedule(this.ready.shift());
        }
    };

    TaskGraph.prototype._findReadyTasks = function () {
        var self = this;
        _.forEach(self.tasks, function(task) {
            if (task.outcome === 'finished') {
                return;
            }
            if (_.isEmpty(task.waitingOn)) {
                return;
            }
            var ready = _.every(task.waitingOn, function(desiredState, _taskId) {
                assert.ok(self.tasks[_taskId]);
                return self.tasks[_taskId].outcome === desiredState;
            });
            if (ready) {
                self.ready.push(task);
            }
        });
    };

    return TaskGraph;
}
