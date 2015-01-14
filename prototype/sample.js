'use strict';
var Rx = require('rx');
var util = require('util');
var events = require('events');
var eventEmitter = new events.EventEmitter();
var uuid = require('node-uuid');


function Scheduler(){
    this.scheduled = [];
    this.Running= {};
    this.runComplete = [];
    this.maxConcurrent = 3;
    this.currentlyRunning = 0;
    this.on('scheduled', this.evaluateWork.bind(this));
    this.on('completed', this.evaluateWork.bind(this));
}
util.inherits(Scheduler, events.EventEmitter);

Scheduler.prototype.wrapData = function(taskData) {
    return {
        work:taskData,
        id: uuid.v4(),
        stats: {
            created: new Date(),
            started: null,
            completed: null
        }
    };
};

Scheduler.prototype.schedule = function(data){
    var workItem = this.wrapData(data);
    console.log('SCHEDULING: '+ workItem.id + ', iteration: '+data.iteration + ', lastdelay:'+data.lastDelay);
    this.scheduled.push(workItem);
    this.emit('scheduled');
};

Scheduler.prototype.evaluateWork= function() {
    console.log('checkwork started')
    if(this.scheduled.length == 0){
        console.log('no work ito be run');
        return;
    }
    if(this.currentlyRunning >= this.maxConcurrent) {
        console.log('max concurrent already running: '+ this.currentlyRunning)
        return;
    }
    this.currentlyRunning += 1;
    var nextWorkItem = this.scheduled.shift();
    nextWorkItem.stats.started = new Date();
    console.log('CHECKWORKRUNNING TASK: '+ nextWorkItem.id);
    this.Running[nextWorkItem.id] = nextWorkItem;
    var self = this;
    doArbitraryWork(function(){
        self.done(nextWorkItem,arguments[1]);
    },nextWorkItem.work);
};

Scheduler.prototype.done = function(completedWorkItem, output) {
    console.log('RUNCOMPLETE: ' + completedWorkItem.work.iteration );
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
setTimeout(function(){console.log('test')}, 60000);
