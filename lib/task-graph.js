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
        'Logger',
        'Q',
        '_'
    )
);

function factory(Task, Scheduler, Logger, Q, _) {
    var logger = Logger.initialize(factory);

    function TaskGraph(overrides) {
        if (!(this instanceof TaskGraph)) {
            return new TaskGraph(overrides);
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

        this.options = _.defaults(overrides || {}, optionDefaults);

        logger.log(this.options.loggingLevel, 'Graph created');

        this.cancelled = false;
        this.nodes = {};

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

    TaskGraph.create = function (overrides) {
        return new TaskGraph(overrides);
    };

    TaskGraph.prototype.createTask = function (task) {
        task;
    };

    TaskGraph.prototype.createTask = function (task) {
        task;
    };


    TaskGraph.prototype.validate = function () {

    };

    TaskGraph.prototype.start = function () {
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
}
