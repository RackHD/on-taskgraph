// Copyright 2015, EMC, Inc.
/* jshint: node:true */

'use strict';

var di = require('di');

module.exports = runnerFactory;

di.annotate(runnerFactory, new di.Provide('TaskGraph.Runner'));
di.annotate(runnerFactory, new di.Inject(
        'Services.Core',
        //'TaskGraph.Subscriptions',
        'TaskGraph.DataLoader',
        //'TaskGraph.ServiceGraph',
        'TaskGraph.TaskScheduler',
        'TaskGraph.TaskRunner',
        'TaskGraph.LeaseExpirationPoller',
        'Task.Messenger',
        'Promise'
    )
);
function runnerFactory(
    core,
    dataLoader,
    TaskScheduler,
    TaskRunner,
    LeaseExpirationPoller,
    taskMessenger,
    Promise
) {
    function Runner() {
        this.taskRunner = null;
        this.taskScheduler = null;
    }

    Runner.prototype.start = function(options) {
        var self = this;

        return core.start()
        .then(function() {
            return dataLoader.start();
        })
        .then(function() {
            return taskMessenger.start();
        })
        .then(function() {
            if (options.runner) {
                self.taskRunner = TaskRunner.create();
                return self.taskRunner.start();
            }
        })
        .then(function() {
            if (options.scheduler) {
                self.taskScheduler = TaskScheduler.create();
                return self.taskScheduler.start();
            }
        });
        // TODO: re-implement service graph running
    /*
        }).then(function() {
            return taskGraphSubscriptions.start();
        }).then(function() {
            return serviceGraph.start();
    */
    };

    Runner.prototype.stop = function() {
        var self = this;

        return Promise.resolve()
        .then(function() {
            if (self.taskRunner) {
                self.taskRunner.stop();
            }
            if (self.taskScheduler) {
                self.taskScheduler.stop();
            }
        })
        .then(function() {
            return core.stop();
        });

        // TODO: add stop for task scheduler and task runners

    /*
        return scheduler.stop().then(function() {
            return serviceGraph.stop();
        }).then(function() {
            return taskGraphSubscriptions.stop();
        }).then(function() {
            return core.stop();
        });
    */
    };

    return new Runner();
}
