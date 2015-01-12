module.exports = Scheduler;

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

'use strict';
var Rx = require('rx');
var util = require('util');
var events = require('events');
var eventEmitter = new events.EventEmitter();
var uuid = require('node-uuid');


function Scheduler(optionOverrides){
    if (!(this instanceof Scheduler)) {
        return new Scheduler(optionOverrides);
    }
    var optionDefaults = {
        name: 'Default Scheduler Name',
        concurrentTasks: 3
    };
    this.id = uuid.v4();
    this.options = lodash.defaults(optionOverrides | {}, optionDefaults);
    this.shutdown = false;
    this.toRun = [];
    this.Running= {};
    this.runComplete = [];
    this.currentlyRunning = 0;
    this.on('scheduled', this.evaluateWork.bind(this));
    this.on('completed', this.evaluateWork.bind(this));
    this.stats = {
        tasksQueued: 0,
        timesPaused: 0,
        timesStarted: 0,
        timesStatusPolled: 0,
    };
    this._complete = Q.defer();
    this.complete = this._complete.promise;
}
util.inherits(Scheduler, events.EventEmitter);

Scheduler.prototype.status = function(){
    return {
        queueLength: this.toRun.length,
        running: this.Running.length,
        shutdown: this.shutdown,
        stats: this.stats
    };
};

Scheduler.prototype.wrapData = function(taskData) {
    return {
        taskData:taskData,
        id: uuid.v4(),
        stats: {
            created: new Date(),
            started: null,
            completed: null
        }
    };
};

Scheduler.prototype.shutdown = function(){
    this.shutdown = true;
    var self = this;
    this.on('shutdowncomplete', function(){
        self._complete.resolve(self.stats);
    });
};

Scheduler.prototype.schedule = function(data){
    var workItem = this.wrapData(data);
    console.log('SCHEDULING: '+ workItem.id + ', iteration: '+data.iteration + ', lastdelay:'+data.lastDelay);
    this.toRun.push(workItem);
    this.emit('scheduled');
};

Scheduler.prototype.evaluateWork= function() {
    console.log('checkwork started')
    if(this.toRun.length == 0){
        console.log('no work ito be run');
        return;
    }
    if(this.currentlyRunning >= this.options.concurrentTasks) {
        console.log('max concurrent already running: '+ this.currentlyRunning)
        return;
    }
    this.currentlyRunning += 1;
    var nextWorkItem = this.toRun.shift();
    nextWorkItem.stats.started = new Date();
    console.log('CHECKWORKRUNNING TASK: '+ nextWorkItem.id);
    this.Running[nextWorkItem.id] = nextWorkItem;
    var self = this;
    doArbitraryWork(function(){
        self.done(nextWorkItem,arguments[1]);
    },nextWorkItem.taskData);
};

Scheduler.prototype.done = function(completedWorkItem, output) {
    console.log('RUNCOMPLETE: ' + completedWorkItem.taskData.iteration );
    delete this.Running[completedWorkItem.id];
    completedWorkItem.stats.finished = new Date();
    console.dir(completedWorkItem);
    this.runComplete.push(completedWorkItem);
    this.currentlyRunning -= 1;
    this.emit('completed');
};

function randomInt (low, high) {
    return Math.floor(Math.random() * (high - low) + low);
}

function doArbitraryWork(done, data){
    var delay = randomInt(1000,2000);

    setTimeout(function(){
        done({iteration:data.iteration, totalWorktime: delay});
    }, delay, data.iteration + 1, delay);

}

function arbitraryExampleEventGenerator(iteration, lastDelay){
    var delay = randomInt(100,300);
    if(iteration < 10) {
        setTimeout(arbitraryExampleEventGenerator, delay, iteration + 1, delay);
    }
    eventEmitter.emit('event', {iteration:iteration, lastDelay:lastDelay});
}

var scheduler = new Scheduler();
var source = Rx.Observable.fromEvent(eventEmitter, 'event');


var subscription = source.subscribe(function(data){scheduler.schedule(data)});


arbitraryExampleEventGenerator(0, 0);
*setTimeout(function(){console.log('test')}, 60000);
