// Copyright 2014, Renasar Technologies Inc.
/* jshint: node:true */
'use strict';

var di = require('di'),
    util = require('util'),
    assert = require('assert'),
    events = require('events'),
    lodash = require('lodash'),
    eventEmitter = new events.EventEmitter();

module.exports = factory;
di.annotate(factory, new di.Provide('TaskGraph.TaskGraph'));
di.annotate(factory,
    new di.Inject(
        'TaskGraph.Task',
        'TaskGraph.Scheduler',
        'Logger'
    )
);

function factory(Task, Scheduler, logger) {
    function TaskGraph(overrides) {
        if (!(this instanceof TaskGraph)) {
            return new TaskGraph(overrides);
        }

        var optionDefaults = {
            name: 'Default Task Graph Name',
            loggingLevel: 'silly',
            states:{
                valid          = ['valid'],
                invalid        = ['invalid'],
                running        = ['running'],
                consumable     = ['observable', 'promised'],
                finalSuccess   = ['success'],
                finalFailure   = ['fail', 'invalid']
                }

        };

        this.options = lodash.defaults(overrides | {}, optionDefaults);

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

    TaskGraph.create(overrides){
        return new TaskGraph(overrides);
    }

    TaskGraph.prototype.createTask = function (task) {

    }

    TaskGraph.prototype.createTask = function (task) {

    }


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
        },)
    };

    TaskGraph.prototype.start = function () {
        this.validate();
        this._heartbeat();
    };

    TaskGraph.prototype._findReadyTasks = function () {

    };
};
