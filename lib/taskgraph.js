var util = require('util');
var _ = require('lodash');
var log = {info:console.log, debug:console.log};
var assert = require('assert');
var Q = require('q');
var uuid = require('node-uuid');
var core = require('renasar-core');
var EventEmitter2 = require('eventemitter2').EventEmitter2;


var lodash = require('lodash');
var defaults = {
    a:'b',
    c: {
        d:'e',
        f:'g'
    }
};
var overrides = {
    c:{f:'new g'}
}
var result = lodash.defaults(overrides, defaults);
console.log(result);


function Task(taskOverrides) {
    assert.notEqual(this, undefined, 'must be called as constructor');
    // take any overrides and apply them to our set of defaults
    var taskDefaults = {};

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



function TaskGraph(graphOverrides) {
    assert.notEqual(this, undefined, 'must be called as constructor');
    log.debug('Graph created');

    this.cancelled = false;
    this.nodes = {};
    this.defaultPriority = 50;
    this._nodesSnapshotAtStart = [];
    this._nodesNotReadyToRun = [];
    this._nodesCompleted = [];
    this._readyToRun = [];
    this.status = 'valid';

    this.tags = [];

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
TaskGraph.prototype.addTask = function (task) {
    return task;
};
//
//TaskGraph.prototype.start = function () {
//    this.validate();
//
//};
//TaskGraph.prototype._findReadyTasks = function () {
//
//
//};
//TaskGraph.prototype.validate = function () {
//
//};
//TaskGraph.prototype.removeTask = function () {
//
//};
//TaskGraph.prototype.getGraphState = function () {
//
//};
//TaskGraph.prototype.addTask = function(){
//
//};

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
var a = taskGraph.addTask([sampleWork, "a should run first",1000]);
var b = taskGraph.addTask([sampleWork, "b should wait on a",1000]).waitOn(a);
var c = taskGraph.addTask([sampleWork, "c should wait on b",1000]).waitOn(b);
var d = taskGraph.addTask([sampleWork, "d should wait on b, c",1000]).waitOn(b,c);
var e = taskGraph.addTask([sampleWork, "e should wait on b, c, d",1000]).waitOn([b,c,d]);
taskGraph.run().then(function(result){
    console.log(result);
});


