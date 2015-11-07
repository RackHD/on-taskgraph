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
        this.pipeline = null;
        this.heart = null;
        this.activeTasks = {};
        this.domain = domain || 'default';
    }

    TaskRunner.prototype.start = function() {
        this.initializePipeline();
        this.startHeart();
        var now = new Date();
        //return taskMessenger.subscribe({domain: this.domain, createdAt: {$gt: now}}, 'taskevents', null, console.log);
        return taskMessenger.subscribeRunTask(
                this.domain,
                this.inputStream.onNext.bind(this.inputStream)
            );
    };


    TaskRunner.prototype.initializePipeline = function() {
        var self = this;
        this.pipeline = this.inputStream.flatMap(function(taskAndGraphId) {
            return store.checkoutTaskForRunner(self.taskRunnerId, taskAndGraphId);
        })
        .filter(function(task) {
            return _.isEmpty(task) ? false : true;
        })
        .flatMap(store.getTaskById)
        .map(function(thing) {
            console.log(thing);
            return thing;
        });

        this.subscriptions.push(
                this.pipeline.subscribe(
                    this.handleTask.bind(this),
                    this.handleError.bind(this)
                )
            );
    };

    TaskRunner.prototype.startHeart = function(interval) {
        interval = interval || 2000;
        this.heart = setInterval(store.heartbeatTasks.bind(store, this.taskRunnerId), interval);
    };

    TaskRunner.prototype.stop = function() {
        clearInterval(this.heart);
        return this.inputStream.dispose();
    };

    function getContext() {return {};}

    TaskRunner.prototype.handleTask = function(task) {
        var self = this;
        logger.debug('going to create task', {data: task});
        var taskInstance = Task.create(
                task,
                {instanceId: task.instanceId}, //overrides
                getContext()
            );
        logger.debug("Running task ", {data: taskInstance.serialize()});
        self.activeTasks[taskInstance.instanceId] = taskInstance;
        return taskInstance.run()
        .finally(function() {
            delete self.activeTasks[taskInstance.taskId];
        });
    };

    TaskRunner.prototype.handleError = function(err) {
        logger.error('Error processing task', {error:err});
    }

    return  TaskRunner;
}
