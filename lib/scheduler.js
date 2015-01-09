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
