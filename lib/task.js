'use strict';
var Q = require('q');
var uuid = require(node-uuid);
var core = require('renasar-core');

module.exports = SetupTask(Q, uuid);

function SetupTask(Q, uuid) {

    function Task(taskOverrides) {
        var taskDefaults = {
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
            external: {
            }
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
    }

    Task.prototype.work = function(){

    };

    Task.prototype.run = function(){
        // can assert/validate that when we are run, all of the tasks we are
        // waiting on can be confirmed as being in a state we accept as satisfying
        // our wait.  this allows us to ensure that we do not start before anything

        //graph is the context it is running in, graph contains information and
        //functions that allow this instance of a task runner to communicate the
        //success or failure of this function

        // returns 'complete' promise
    };

    //when someone finsihes a http requests for a specific file from a specifc ip
    Task.prototype.changeState = function(state) {

    };

    Task.prototype.run = function(){
        // can assert/validate that when we are run, all of the tasks we are
        // waiting on can be confirmed as being in a state we accept as satisfying
        // our wait.  this allows us to ensure that we do not start before anything

        //graph is the context it is running in, graph contains information and
        //functions that allow this instance of a task runner to communicate the
        //success or failure of this function
    };


//when someone finsihes a http requests for a specific file from a specifc ip
    Task.prototype.changeState = function(state) {


    };

    Task.prototype.addDependency = function(otherTask) {

    };

}
