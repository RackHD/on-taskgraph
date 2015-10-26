// Copyright 2015, EMC, Inc.
//
'use strict';

var di = require('di');
module.exports = taskRunnerFactory;
di.annotate(taskRunnerFactory, new di.Provide('TaskGraph.TaskRunner'));
di.annotate(taskRunnerFactory,
    new di.Inject(
        'Logger',
        'Promise',
        'Constants',
        'Assert',
        'uuid',
        '_',
        'Rx',
        'Task.Task',
        'Task.Messenger',
        'TaskGraph.Store'
    )
);

function taskRunnerFactory(
    Logger,
    Promise,
    Constants,
    assert,
    uuid,
    _,
    Rx,
    Task,
    taskMessenger,
    store
) {
    var logger = Logger.initialize(taskRunnerFactory);

    function TaskRunner(domain) {
        this.taskRunnerId = uuid.v4();
        this.inputStream = new Rx.Subject();
        this.subscriptions = [];
        this.activeTasks = {};
        this.pipeline = null;
        this.domain = domain || 'defaultDomain';
    }

    TaskRunner.prototype.start = function() {
        this.initializePipeline();

        return taskMessenger.subscribeRun(this.domain, this.inputStream.onNext);
    };

    TaskRunner.prototype.initializePipeline = function() {
        this.pipeline = this.inputStream.flatMap(function(taskAndGraphId) {
            return store.checkoutTask(taskAndGraphId.taskId);
        }, function(taskAndGraphId, maybeNullTask) {
            return {
                definition: maybeNullTask,
                graphId: taskAndGraphId.graphId
            };
        })
        .filter(function(task) {
            return _.isEmpty(task.definition) ? false : true;
        });

        this.subscriptions.push(
                this.pipeline.subscribe(
                    this.handleTask
                )
            );
    };

    TaskRunner.prototype.stop = function() {
        return this.inputStream.dispose();
    };

    function getContext() {return {};}

    TaskRunner.prototype.handleTask = function(task) {
        console.log(task);
        var taskInstance = Task.create(
                task.definition,
                {}/*Overrides?*/,
                getContext()/*or something?*/
            );
        this.activeTasks[taskInstance.instanceId] = taskInstance;
        taskInstance.run();
    };

    return TaskRunner;
}
