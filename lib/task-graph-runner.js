// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di');

module.exports = runnerFactory;

di.annotate(runnerFactory, new di.Provide('TaskGraph.Runner'));
di.annotate(runnerFactory, new di.Inject(
        'Services.Waterline',
        'Services.Core',
        'TaskGraph.TaskScheduler',
        'TaskGraph.TaskRunner',
        'TaskGraph.LeaseExpirationPoller',
        'Task.Messenger',
        'TaskGraph.DataLoader',
        'TaskGraph.CompletedTaskPoller',
        'TaskGraph.ServiceGraph',
        'TaskGraph.Store',
        'Promise',
        'Profiles',
        'Templates',
        '_'
    )
);
function runnerFactory(
    waterline,
    core,
    TaskScheduler,
    TaskRunner,
    LeaseExpirationPoller,
    taskMessenger,
    loader,
    CompletedTaskPoller,
    serviceGraph,
    store,
    Promise,
    profiles,
    templates,
    _
) {
    /**
     * @construtor
     */
    function Runner() {
        this.taskRunner = null;
        this.taskScheduler = null;
        this.completedTaskPoller = null;
    }

    /**
     *
     * @param options - run options, specifies which services to start
     * @param options.runner Boolean value, specifies whether to start the TaskRunner service
     * @param options.scheduler Boolean value, specifies whether to start the
     *                          TaskScheduler and CompletedTaskPoller services
     * @param [options.domain] Optional domain string to run all services in, defaults to
     *                         Constants.DefaultTaskDomain ('default')
     *
     * @memberOf Runner
     */
    Runner.prototype.start = function(options) {
        var self = this;

        return core.start()
        // Remove profiles and templates from db to force reload and update file
        // paths to on-taskgraph from on-http
        .then(function() {
            return Promise.all([waterline.profiles.destroy(), waterline.templates.destroy()]);
        })
        .then(function() {
            return Promise.all([profiles.load(), templates.load()]);
        })
        .then(function() {
            return [
                loader.load(),
                taskMessenger.start()
            ];
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

    /**
     * @memberOf Runner
     */
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
