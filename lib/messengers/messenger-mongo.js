'use strict';

var di = require('di');

module.exports = mongoMessengerFactory;
di.annotate(mongoMessengerFactory, new di.Provide('Task.Messenger.mongo'));
di.annotate(mongoMessengerFactory,
    new di.Inject(
        'Services.Waterline',
        '_'
    )
);

function mongoMessengerFactory(waterline, _) {
    //promise returning messenger clones.... -.-

    var taskevents = 'taskevents';

    function subscribe(query, collection, options, callback) {
        options = options || {};
        var defaults =  {
            tailable: true,
            awaitdata: true,
            numberOfRetries: -1,
            fields: { 'data': 1, '_id': 0 }
        };

        options = _.defaults(options, defaults);
        return waterline[collection].runNativeMongo('find', [query, options])
        .then(function(doc) {
            var eStream = doc.sort({$natural: -1}).stream();
            eStream.on('data', function(docData) {
                return callback(docData.data);
            });
            return eStream;
        });
    }

    function subscribeRunTask(domain, callback) {
        var query = {
            domain: domain,
            createdAt: {$gt: new Date()}
        };
        return subscribe(query, taskevents, null, callback);
    }

    function publishRunTask(domain, args) {
        return waterline.taskevents.create({
            domain: domain,
            data: args
        });
    }

    function subscribeCancelTask(taskId, callback) {
        var query = {
            cancel: taskId,
            createdAt: {$gt: new Date()}
        };
        return subscribe(query, taskevents, null, callback);
    }

    function publishCancelTask(taskId) {
        return waterline.taskevents.create({
            cancel: taskId
        });
    }

    function subscribeTaskFinished(taskId, callback) {
        var query = {
            finished: taskId,
            createdAt: {$gt: new Date()}
        };
        return subscribe(query, taskevents, null, callback);
    }

    function publishTaskFinished(taskId, data) {
        return waterline.taskevents.create({
            finished: taskId,
            data: data
        });
    }

    function subscribeCancelGraph(graphId, callback) {
        //pretty much useless
        var query = {
            cancel: graphId
        };
        return subscribe(query, taskevents, null, callback);
    }

    function publishCancelGraph(graphId) {
        //pretty much useless
        return waterline.taskevents.create({
            cancel: graphId
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
        subscribeCancelGraph: subscribeCancelGraph,
        publishCancelGraph: publishCancelGraph,
        start: start
    };
}
