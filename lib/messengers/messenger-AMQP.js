// Copyright 2015, EMC, Inc.
'use strict';

var di = require('di');

module.exports = amqpMessengerFactory;
di.annotate(amqpMessengerFactory, new di.Provide('Task.Messenger.AMQP'));
di.annotate(amqpMessengerFactory,
    new di.Inject(
        'Protocol.Task',
        'Protocol.Events',
        'Promise',
        'Protocol.TaskGraphRunner'
    )
);

function amqpMessengerFactory(taskProtocol, eventsProtocol, Promise, taskGraphProtocol) {
    //promise returning messenger clones.... -.-

    function subscribeRunTask(domain, callback) {
        return taskProtocol.subscribeRun(domain, callback);
    }

    function publishRunTask(domain, taskId, graphId) {
        return taskProtocol.run(domain, { taskId: taskId, graphId: graphId });
    }

    function subscribeCancelTask(taskId, callback) {
        return taskProtocol.subscribeCancel(taskId, callback);
    }

    function publishCancelTask(taskId) {
        //err name? err message?
        return taskProtocol.cancel(taskId);
    }

    function subscribeTaskFinished(domain, callback) {
        return eventsProtocol.subscribeTaskFinished(domain, callback);
    }

    function publishTaskFinished(domain, taskId, graphId, state) {
        return eventsProtocol.publishTaskFinished(domain, taskId, graphId, state);
    }

    function subscribeCancelGraph() {
        return taskGraphProtocol.subscribeCancelTaskGraph();
    }

    function publishCancelGraph() {
        return taskGraphProtocol.cancelTaskGraph();
    }

    function start() {
        return Promise.resolve;
    }

    return {
        subscribeRunTask: subscribeRunTask,
        publishRunTask: publishRunTask,
        subscribeCancelTask: subscribeCancelTask,
        publishCancelTask: publishCancelTask,
        subscribeTaskFinished: subscribeTaskFinished,
        publishTaskFinished: publishTaskFinished,
        subscribeCancelGraph: subscribeCancelGraph,
        publishCancelGraph: publishCancelGraph,
        start: start
    };
}
