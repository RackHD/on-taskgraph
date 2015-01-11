'use strict';
var Rx = require('rx');
var events = require('events');
var util = require('util');
var eventEmitter = new events.EventEmitter();


function Scheduler(){
    this.toRun = [];
    this.Running= [];
    this.runComplete = [];
    this.maxConcurrent = 3;
    this.currentlyRunning = 0;
    this.on('scheduled', function(){this.checkWork()});
    this.on('completed', function(){this.checkWork()});
}
util.inherits(Scheduler, events.EventEmitter);

Scheduler.prototype.schedule = function(data){
    console.log('SCHEDULING: received new work: iteration: '+data.iteration + ', lastdelay:'+data.lastDelay);
    this.toRun.push(data);
    this.emit('scheduled');
};

Scheduler.prototype.checkWork= function() {
    console.log('checkwork started')
    if(this.toRun.length == 0){
        console.log('no work ito be run');
        return;
    }
    if(this.currentlyRunning >= this.maxConcurrent) {
        console.log('max concurrent already running: '+ this.currentlyRunning)
        return;
    }
    this.currentlyRunning += 1;
    var next = this.toRun.shift();
    console.log('CHECKWORKRUNNING TASK: '+ next.iteration)
    this.Running.push(next);
    var self = this;
    doArbitraryWork(function(){self.done.apply(self,arguments)},next);
};

Scheduler.prototype.done = function(data) {
    console.log('RUNCOMPLETE: ' + data.iteration );
    this.runComplete.push(data);
    this.currentlyRunning -= 1;
    this.emit('completed');
};

function randomInt (low, high) {
    return Math.floor(Math.random() * (high - low) + low);
}

function doArbitraryWork(done, data){
    var delay = randomInt(10000,12000);

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
