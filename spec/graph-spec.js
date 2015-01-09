'use strict';
require('./spec-helper');

var util = require('util');
var _ = require('lodash');
var log = {info:console.log, debug:console.log};
var Q = require('q');
var graph = require('./../lib/graph.js');

var MockPromisedWorkDelay = function (runId, timeout){
    var deferred = Q.defer();
    log.info(runId + ': starting some work, delaying ' + timeout + 'ms');
    setTimeout(function(){
        log.info(runId + ': completed simulated task, resolving promise after '+timeout+'ms');
        deferred.resolve({runId: runId, timeout: timeout});
    }, timeout);
    return deferred.promise;
};

var MockObservableWork = function (runId, timeout, totalItems) {

};

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
    var scheduler = new graph.SchedulerConcurrent();

    it('scheduler exists', function(){
        expect(scheduler).to.exist;
    });
});

