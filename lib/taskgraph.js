// Copyright 2014, Renasar Technologies Inc.
/* jshint: node:true */
'use strict';

var di = require('di'),
    util = require('util'),
    assert = require('assert'),
    events = require('events'),
    eventEmitter = new events.EventEmitter();



function TaskGraph(optionOverrides) {
    if (!(this instanceof TaskGraph)) {
        return new TaskGraph(optionOverrides);
    }

    var optionDefaults = {
        name: 'Default Task Graph Name',
        taskPriority: 50,
        heartbeatInterval: 250,
        loggingLevel: 'silly'
    };

    this.options = lodash.defaults(optionOverrides | {}, optionDefaults);

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

    this.statusWorking = ['running'];
    this.statusValidatedReady = ['valid'];
    this.statusConsumable = ['observable', 'promised'];
    this.statusFinalSuccesses = ['success'];
    this.statusFinalFailures = ['fail', 'invalid'];

    this.stats = {
        totalNodes: 0,
        totalEdges: 0,
        cycleDetected: false,
        longestChain: 0,
        mostDependents: 0,
        taskDetails: {
            // taskuuid: {
            //   waited: xxxxx,
            //   runtime: xxxxx,
            //   completed: xxxxx,
            //   startingOrder: xx,
            //   completionOrder: xx,
            //   started: Date,
            //   ended: Date,
            //   detail: {} // to be filled in by task
            // }
        }
    };

    return this;
}
util.inherits(TaskGraph, events.EventEmitter);

TaskGraph.prototype.addTask = function (task) {
    return task;
};

TaskGraph.prototype.validate = function () {

};

TaskGraph.prototype.start = function () {
    this._findReadyTasks();
    while(this.ready.length > 0) {
        this.schedule(this.ready.shift());
    }
    var self = this;
    setTimeout(function(){self._heartbeat();},)
};

TaskGraph.prototype.start = function () {
    this.validate();
    this._heartbeat();
};

TaskGraph.prototype._findReadyTasks = function () {

};

var logger = {info:console.log};
var sampleWork = function (text, timeout){
    var deferred = Q.defer();
    logger.info(runId + ': starting some work, delaying ' + timeout + 'ms');
    setTimeout(function(){
        logger.info(runId + ': completed simulated task, resolving promise after '+timeout+'ms');
        deferred.resolve({runId: runId, timeout: timeout});
    }, timeout);
    return deferred.promise;
};

var taskGraph = new TaskGraph({name: 'sample graph', nodeTimeout: 2000});
var a = taskGraph.addTask([sampleWork, null, "a should run first",1000]);
var b = taskGraph.addTask([sampleWork, null, "b should wait on a",1000]).waitOn(a);
var c = taskGraph.addTask([sampleWork, null, "c should wait on b",1000]).waitOn(b);
var d = taskGraph.addTask([sampleWork, null, "d should wait on b, c",1000]).waitOn(b,c);
var e = taskGraph.addTask([sampleWork, null, "e should wait on b, c, d",1000]).waitOn([b,c,d]);
taskGraph.run().then(function(result){
    console.log(result);
});


