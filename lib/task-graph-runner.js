// Copyright 2015, EMC, Inc.
/* jshint: node:true */

'use strict';

var di = require('di');

module.exports = runnerFactory;

di.annotate(runnerFactory, new di.Provide('TaskGraph.Runner'));
di.annotate(runnerFactory, new di.Inject(
        'Services.Core',
        'TaskGraph.TaskScheduler',
        'TaskGraph.TaskRunner',
        'TaskGraph.LeaseExpirationPoller',
        'Task.Messenger',
        'TaskGraph.DataLoader',
        'TaskGraph.CompletedTaskPoller',
        'TaskGraph.ServiceGraph',
        'Promise'
    )
);
function runnerFactory(
    core,
    TaskScheduler,
    TaskRunner,
    LeaseExpirationPoller,
    taskMessenger,
    loader,
    CompletedTaskPoller,
    serviceGraph,
    Promise
) {
    function Runner() {
        this.taskRunner = null;
        this.taskScheduler = null;
        this.completedTaskPoller = null;
    }

    Runner.prototype.start = function(options) {
        var self = this;

        return core.start()
        .then(function() {
            return [loader.load(), taskMessenger.start()];
        })
        .spread(function() {
            var startPromises = [];
            if (options.runner) {
                self.taskRunner = TaskRunner.create({ domain: options.domain });
                startPromises.push(self.taskRunner.start());
            }
            if (options.scheduler) {
                self.taskScheduler = TaskScheduler.create({ domain: options.domain });
                startPromises.push(self.taskScheduler.start());
                self.completedTaskPoller = CompletedTaskPoller.create(self.taskScheduler.domain);
                startPromises.push(self.completedTaskPoller.start());
            }
            return startPromises;
        })
        .spread(function() {
            return serviceGraph.start(options.domain);
        });
    };

    Runner.prototype.stop = function() {
        var self = this;

        return Promise.resolve()
        .then(function() {
            var stopPromises = [];
            if (self.taskRunner) {
                stopPromises.push(self.taskRunner.stop());
            }
            if (self.taskScheduler) {
                stopPromises.push(self.taskScheduler.stop());
            }
            if (self.completedTaskPoller) {
                stopPromises.push(self.completedTaskPoller.stop());
            }
            return stopPromises;
        })
        .spread(function() {
            return core.stop();
        });
    };

    return new Runner();
}
