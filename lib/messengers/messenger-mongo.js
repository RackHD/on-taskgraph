'use strict';

var di = require('di');

module.exports = mongoMessengerFactory;
di.annotate(mongoMessengerFactory, new di.Provide('Task.Messenger.mongo'));
di.annotate(mongoMessengerFactory,
    new di.Inject(
        'Services.Waterline',
        'Logger',
        '_'
    )
);

function mongoMessengerFactory(waterline, Logger, _) {
    var logger = Logger.initialize(mongoMessengerFactory);
    //promise returning messenger clones.... -.-

    function subscribe(query, options, callback) {
        var defaults =  {
            tailable: true,
            awaitdata: true,
            numberOfRetries: -1,
            fields: { 'data': 1, '_id': 0 }
        };
        options = _.defaults(options || {}, defaults);

        // TODO: we need a way to dispose of these subscriptions upstream
        // This would be another good opportunity to make use of Rx observables.
        return waterline.taskevents.runNativeMongo('find', [query, options])
        .then(function(doc) {
            var eventStream = doc.sort({
                $natural: -1
            }).stream();

            eventStream.on('error', function(error) {
                logger.error('An error occurred with the task event stream', {
                    error: error
                });
            });

            eventStream.on('data', function(docData) {
                callback(docData.data);
            });

            return eventStream;
        });
    }

    function subscribeRunTask(domain, callback) {
        var query = {
            domain: domain,
            action: 'create',
            createdAt: {
                $gt: new Date()
            }
        };
        return subscribe(query, null, callback);
    }

    function publishRunTask(domain, taskId, graphId) {
        return waterline.taskevents.create({
            domain: domain,
            action: 'create',
            data: {
                taskId: taskId,
                graphId: graphId,
            }
        })
        .then(function(result) {
            return {
                domain: result.domain,
                graphId: result.data.graphId,
                taskId: result.data.taskId
            };
        });
    }

    function subscribeCancelTask(domain, callback) {
        var query = {
            domain: domain,
            action: 'cancel',
            createdAt: {
                $gt: new Date()
            }
        };
        return subscribe(query, null, callback);
    }

    function publishCancelTask(domain, taskId) {
        return waterline.taskevents.create({
            domain: domain,
            action: 'cancel',
            data: {
                taskId: taskId
            }
        });
    }

    function subscribeTaskFinished(domain, callback) {
        var query = {
            domain: domain,
            action: 'finish',
            createdAt: {
                $gt: new Date()
            }
        };
        return subscribe(query, null, callback);
    }

    function publishTaskFinished(domain, taskId, graphId, taskState) {
        return waterline.taskevents.create({
            domain: domain,
            action: 'finish',
            data: {
                taskId: taskId,
                graphId: graphId,
                taskState: taskState
            }
        });
    }

    function start() {
        return waterline.taskevents.create({});
    }

    return {
        subscribe: subscribe,
        subscribeRunTask: subscribeRunTask,
        publishRunTask: publishRunTask,
        subscribeCancelTask: subscribeCancelTask,
        publishCancelTask: publishCancelTask,
        subscribeTaskFinished: subscribeTaskFinished,
        publishTaskFinished: publishTaskFinished,
        start: start
    };
}
