module.exports = exports = Scheduler;


var scopes = {

};

function Scheduler(){
    this.scheduled = [];
    this.ready = [];
    this.done = [];
}

// used to update schedule one or more jobs to actually be run
SchedulerBase.prototype.schedule = function(taskToRun) {
};

// Stop any new tasks from starting
SchedulerBase.prototype.pause = function(){
};

// Start serving tasks again
SchedulerBase.prototype.start = function(){
};

// report any relevant status information on # of queued and running tasks
SchedulerBase.prototype.status = function(){
    return {
        queueLength: this.tasksToRun.length,
        running: this.running,
        shutdown: this.shutdown,
        stats: this.stats
    };
};

// stop running new tasks, attempt controlled shutdown on any tasks
// supporting shutdown
SchedulerBase.prototype.shutdown = function(){
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
