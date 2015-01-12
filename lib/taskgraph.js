// Copyright 2014, Renasar Technologies Inc.
/* jshint: node:true */
'use strict';

var di = require('di'),
    util = require('util'),
    assert = require('assert'),
    events = require('events'),
    eventEmitter = new events.EventEmitter();

function Task(taskGraph, optionOverrides) {
    if (!(this instanceof Task)) {
        return new Task(taskGraph, optionOverrides);
    }
    // take any overrides and apply them to our set of defaults
    var optionDefaults = {
        name: 'Default Task Name'
    };
    this.options = lodash.defaults(optionOverrides | {}, optionDefaults);
    this.taskGraph = taskGraph;

    this.id = uuid.v4();

    // run state related properties
    this.cancelled = false;
    this.retriesAttempted = 0;
    this.retriesAllowed = taskOverides.retriesAllowed || 5;

    taskOverides = taskOverrides || {};
    this.instanceId = taskOverrides.instanceId || uuid();
    this.name = taskOverrides.name || this.instanceId;
    this.injectableTaskRunner =
        taskOverrides.injectableTaskRunner ||
        'default-task';
    this.waitingOn = taskOverides.waitingOn || [];
    this.status = 'waiting';
    this.tags = [];


    this.work = task;
    this.dependents = [];
    this.outcome = 'pending';
    this._result = Q.defer();
    this.result = this._result.promise;
    this.stats = {
        created: new Date(),
        started: null,
        completed: null
    };

    // used for logging to ensure all log lines allow tracing work
    // to this specific instance of the run
    this.taskId = uuid.v4();

    // human readable name
    this.friendlyName = this.taskId;


    // tags for categorization and hinting functionality
    this.tags = [];

    this.context = {
        // starts as false, this is changed to true if the job is cancelled
        // or times out - this is the place to check inside a loop whether
        // to continue to do work.
        canceled: false,
        local: {
            stats: {}
        },
        parent: {}
    };

    // internal representation of deferred object
    this._complete = Q.defer();

    // promise for when the Task enters into a final state
    this.complete = this._complete.promise;

    // state of the current object
    this.state = 'pending';

    // hint to whatever is running the task when it is successful
    this.successStates = ['success'];

    // hint to whatever is running the task when it has failed
    this.failedStates = ['failed', 'timeout'];

    // default timeout that kills the task if it runs longer than this
    // -1 means wait forever, specified in milliseconds.  Will fail job
    // with state 'timeout'.
    this.timeOut = 5000;

    return this;
}

Task.prototype.work = function () {

};

//when someone finsihes a http requests for a specific file from a specifc ip
Task.prototype.changeState = function (state) {

};

Task.prototype.run = function () {
    // can assert/validate that when we are run, all of the tasks we are
    // waiting on can be confirmed as being in a state we accept as satisfying
    // our wait.  this allows us to ensure that we do not start before anything

    //graph is the context it is running in, graph contains information and
    //functions that allow this instance of a task runner to communicate the
    //success or failure of this function
};


//when someone finsihes a http requests for a specific file from a specifc ip
Task.prototype.changeState = function (state) {


};


var waitObject = {
    taskInstanceId: '0___ uuid here ____ 0',
    statesSatisfyingWait: ['success']
};


Task.prototype.waitOn = function (waitObject) {
    assert.equal(this.status, 'waiting', 'only newly initialized or still ' +
    'waiting tasks can add additional tasks to wait on');
    this.waitingOn.push(waitObject);
    return this;
};

Task.prototype.run = function (graph) {
    // can assert/validate that when we are run, all of the tasks we are
    // waiting on can be confirmed as being in a state we accept as satisfying
    // our wait.  this allows us to ensure that we do not start before anything

    //graph is the context it is running in, graph contains information and
    //functions that allow this instance of a task runner to communicate the
    //success or failure of this function
};


//when someone finsihes a http requests for a specific file from a specifc ip
Task.prototype.changeState = function (state) {

};



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


