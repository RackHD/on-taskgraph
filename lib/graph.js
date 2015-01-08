var util = require('util');
var _ = require('lodash');
var log = {info:console.log, debug:console.log};
var Q = require('q');
var assert = require('assert');

module.exports = {
    SchedulerConcurrent: SchedulerConcurrent,
    TaskPromise: TaskPromise,
    TaskObservable: TaskObservable
};

//function registerWithMessageBus(messageFunctionMap) {
//    assert.notEqual(messageFunctionMap, undefined, 'must provide function map');
//    // map channel/topic/filter function -> thing that should be subscribed
//    // map some pre-defined set of strings to -> channel/topic that should be
//    //     published to
//    // return cancellable subscriptions + string -> functions that will blast
//    //     out event to appropriate message bus destination
//}

// Scheduler is responsible for taking a task or tasks and actually launching
// them by calling their run().  More complex schedulers can make use of
// queues hinted through tags, etc.
function SchedulerBase() {
    assert.notEqual(this, undefined, 'must be called as constructor');
    log.debug('SchedulerBase created');
    this.continueDefer = Q.defer();
    this.continue = this.continueDefer.promise;
    this.running = false;
    this.shutdown = false;
    this.heartbeatTimeout = null;
    this.tasksRunning = 0;
    this.heartbeatMs = 1000;
    this.tasksToRun = [];
    this.stats = {
        tasksQueued: 0,
        timesPaused: 0,
        timesStarted: 0,
        timesStatusPolled: 0,
        heartbeats: 0
    };
}

// used to update status of jobs, housecleaning, etc.
SchedulerBase.prototype._heartbeat = function() {
    log.debug('heartbeat');
    clearTimeout(this.timeout);
    this.timeout = setTimeout(this._heartbeat, this.heartbeatTimeout);
    this.stats.heartbeats++;
};


// Anticipate adding SchedulerHierarchical where there would be more than one
// queue with each queue allowing for resource throttling (i.e. max concurrent
// tasks or other things the tasks register for with the scheduler).
function SchedulerConcurrent(){
    assert.notEqual(this, undefined, 'must be called as constructor');
    log.debug('SchedulerConcurrent created');
    SchedulerBase.apply(this, Array.prototype.slice.call(arguments));
    this.maxConcurrentTasks = 1;
}
util.inherits(SchedulerConcurrent, SchedulerBase);

function Graph(graphOverrides){
    assert.notEqual(this, undefined, 'must be called as constructor');
    log.debug('Graph created');

    this.cancelled = false;
    this.dependencies = {};
    this.tasks = {};
    this.ready = [];
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
    }
}
Graph.prototype.run = function() {
    this.validate();
};
Graph.prototype.validate = function() {

};
Graph.prototype.addTask = function(task) {

};
Graph.prototype.removeTask = function() {

};
Graph.prototype.getGraphState = function() {

};

var waitObject = {
    taskInstanceId: '0___ uuid here ____ 0',
    statesSatisfyingWait: ['success']
};

function TaskBase(taskOverrides){
    assert.notEqual(this, undefined, 'must be called as constructor');

    this.cancelled = false;

    taskOverides = taskOverrides || {};
    this.instanceId = taskOverrides.instanceId || uuid();
    this.name = taskOverrides.name || this.instanceId;
    this.injectableTaskRunner =
        taskOverrides.injectableTaskRunner ||
        'default-task';
    this.waitingOn = taskOverides.waitingOn || [];
    this.status = 'waiting';
    this.tags = [];

    this.retriesAttempted = 0;
    this.retriesAllowed = taskOverides.retriesAllowed || 5;

    // overide as needed in children
}

TaskBase.prototype.waitOn = function(waitObject) {
  assert.equal(this.status, 'waiting', 'only newly initialized or still ' +
  'waiting tasks can add additional tasks to wait on');
  this.waitingOn.push(waitObject);
};

TaskBase.prototype.run = function(graph){
    // can assert/validate that when we are run, all of the tasks we are
    // waiting on can be confirmed as being in a state we accept as satisfying
    // our wait.  this allows us to ensure that we do not start before anything

    //graph is the context it is running in, graph contains information and
    //functions that allow this instance of a task runner to communicate the
    //success or failure of this function
};


//when someone finsihes a http requests for a specific file from a specifc ip
TaskBase.prototype.changeState = function(state) {

};

function TaskPromise(){

}
function TaskObservable(){

}


