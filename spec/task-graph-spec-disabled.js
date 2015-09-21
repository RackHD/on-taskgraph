// Copyright 2015, EMC, Inc.

'use strict';

var util = require('util');
var _ = require('lodash');
var log = {info:console.log, debug:console.log};
var Q = require('q');
var graph = require('./../lib/task-graph.js');

var sampleWork = function (text, timeout){
    var deferred = Q.defer();
    log.info(runId + ': starting some work, delaying ' + timeout + 'ms');
    setTimeout(function(){
        log.info(runId + ': completed simulated task, resolving promise after '+timeout+'ms');
        deferred.resolve({runId: runId, timeout: timeout});
    }, timeout);
    return deferred.promise;
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




var EventEmitter2 = require('eventemitter2').EventEmitter2;
var graphInstance = new Graph({name: 'sample graph', nodeTimeout: 2000});
var a = graphInstance.newNode([sampleWork, "a should run first",1000]);
var b = graphInstance.newNode([sampleWork, "b should wait on a",1000]).waitOn(a);
var c = graphInstance.newNode([sampleWork, "c should wait on b",1000]).waitOn(b);
var d = graphInstance.newNode([sampleWork, "d should wait on b, c",1000]).waitOn(b,c);
var e = graphInstance.newNode([sampleWork, "e should wait on b, c, d",1000]).waitOn([b,c,d]);
graphInstance.on('status', function(status){
    logger.log('info', status);
});
graphInstance.on('node-completion', function(status){
    logger.log('info', status);
});
graphInstance.start().then(function(output){
   logger.log('info', 'final output:' + output);
});

var jsonGraph = {
    name: 'sample graph',
    nodeTimeout: 2000,
    nodes: {
        "a": {
            work: ['sampleWork', "a should run first", 1000],
            dependents: ["b"]
        },
        "b": {
            work: ['sampleWork', "b should wait on a", 1000],
            dependents: ["c", "d", "e"]
        },
        "c": {
            work: ['sampleWork', "c should wait on b", 1000],
            dependents: ["d", "e"]
        },
        "d": {
            work: ['sampleWork', "d should wait on b,c", 1000],
            dependents: ["e"]
        },
        "e": {
            work: ['sampleWork', "e should wait on b,c,d", 1000],
            dependents: []
        }
    }
};

var c = graphInstance.newNode([sampleWork, "c should wait on b",1000]).waitOn(b);
var d = graphInstance.newNode([sampleWork, "d should wait on b, c",1000]).waitOn(b,c);
var e = graphInstance.newNode([sampleWork, "e should wait on b, c, d",1000]).waitOn([b,c,d]);


var graphInstance = new Graph({name: 'sample graph', nodeTimeout: 2000});
var a = graphInstance.newNode([sampleWork, "a should run first",1000]);
var b = graphInstance.newNode([sampleWork, "b should wait on a",1000]).waitOn(a);
var observable = graphInstance.asObservable();


describe('Ensure MockPromisedWorkDelay is working before we start', function(){
    describe('MockPromisedWorkDelay mock gives me promise back',function(){
        var expectedResult = {runId:'test1', timeout: 75};
        var prom = MockPromisedWorkDelay(expectedResult.runId,expectedResult.timeout);

        it('exists', function(){
            expect(prom).to.exist;
        });
        it('has a then property', function(){
            expect(prom.then).to.exist;
        });
        it('then property is a function', function(){
            expect(prom.then).to.be.a('function');
        });
        it('produces the expected result', function(){
            return prom.should.eventually.deep.equal(expectedResult);
        })
    });
});

describe('Task',function(){
    it('Task');
});
describe('Graph',function(){
    it('Graph');
});
describe('Scheduler',function(){
    var scheduler = new taskgraph.SchedulerConcurrent();

    it('scheduler exists', function(){
        expect(scheduler).to.exist;
    });
});
