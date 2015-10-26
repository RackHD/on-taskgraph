// Copyright 2015, EMC, Inc.
'use strict';

var di = require('di');

di.annotate(amqpMessengerFactory, new di.Provide('Task.Messenger.AMQP'));
di.annotate(amqpMessengerFactory,
    new di.Inject(
        'Protocol.Task',
        'Protocol.Events',
        'Protocol.TaskGraphRunner'
    )
);

function amqpMessengerFactory(taskProtocol, eventsProtocol, taskGraphProtocol) {
    //promise returning messenger clones.... -.-

    function subscribeRunTask(domain, callback) {
        return taskProtocol.subscribeRun(domain, callback);
    }

    function publishRunTask(domain, args) {
        return taskProtocol.run(domain, args);
    }

    function subscribeCancelTask(taskId, callback) {
        return taskProtocol.subscribeCancel(taskId, callback);
    }

    function publishCancelTask(taskId) {
        //err name? err message?
        return taskProtocol.cancel(taskId);
    }

    function subscribeTaskFinished(taskId, callback) {
        return eventsProtocol.subscribeTaskFinished(taskId, callback);
    }

    function publishTaskFinished(taskId, data) {
        return eventsProtocol.publishTaskFinished(taskId, data);
    }

    function subscribeCancelGraph() {
        return taskGraphProtocol.subscribeCancelTaskGraph();
    }

    function publishCancelGraph() {
        return taskGraphProtocol.cancelTaskGraph();
    }

    return {
        subscribeRunTask: subscribeRunTask,
        publishRunTask: publishRunTask,
        subscribeCancelTask: subscribeCancelTask,
        publishCancelTask: publishCancelTask,
        subscribeTaskFinished: subscribeTaskFinished,
        publishTaskFinished: publishTaskFinished,
        subscribeCancelGraph: subscribeCancelGraph,
        publishCancelGraph: publishCancelGraph
    };
}
