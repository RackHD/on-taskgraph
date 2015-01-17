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
        this.tasks = [];

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
        return {
            create: function(optionOverrides) {
                var _definition = definition;
                var options = _.defaults(_definition, optionOverrides);
                return TaskGraph.create(options);
            },
            definition: definition
        };
    };

    TaskGraph.prototype.createTask = function (task) {
        task;
    };

    TaskGraph.prototype.validate = function () {

    };

    TaskGraph.prototype.populateTaskDependencies = function() {
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
            self.tasks.push(taskInstance);
        });
    };

    TaskGraph.prototype.start = function () {
        this.populateTasks();
        this._findReadyTasks();
        while (this.ready.length > 0) {
            this.schedule(this.ready.shift());
        }
        var self = this;
        setTimeout(function () {
            self._heartbeat();
        });
    };

    TaskGraph.prototype.start = function () {
        this.validate();
        this._heartbeat();
    };

    TaskGraph.prototype._findReadyTasks = function () {

    };

    return TaskGraph;
}
