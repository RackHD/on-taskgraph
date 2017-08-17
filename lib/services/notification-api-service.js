
// Copyright © 2016-2017 Dell Inc. or its subsidiaries.  All Rights Reserved.

'use strict';

var di = require('di');

module.exports = NotificationApiServiceFactory;
di.annotate(NotificationApiServiceFactory, new di.Provide('Http.Services.Api.Notification'));
di.annotate(NotificationApiServiceFactory,
    new di.Inject(
        'Protocol.Events',
        'Logger',
        'Services.Waterline',
        'Errors',
        'Promise',
        'Services.GraphProgress',
        '_'
    )
);

function NotificationApiServiceFactory(
    eventsProtocol,
    Logger,
    waterline,
    Errors,
    Promise,
    graphProgressService,
    _
) {

    function NotificationApiService() {
    }

    NotificationApiService.prototype.postNotification = function(message) {
        var self = this;

        if (_.has(message, 'nodeId')) {
            return self.postNodeNotification(message);
        }
        else {
            // This will be a broadcast notification if no id (like nodeId) is specified
            return self.postBroadcastNotification(message);
        }
    };

    NotificationApiService.prototype.publishTaskProgress = function(message) {
        var progressData;
        return Promise.try(function() {
                message.value = parseInt(message.value);
                message.maximum = parseInt(message.maximum);
                if(!_.isString(message.taskId)) {
                    throw new Errors.BadRequestError('taskId is required for progress notification');
                }
                if(!_.isFinite(message.maximum)) {
                    throw new Errors.BadRequestError('maximum is invalid for progress notification');
                }
                if(!_.isFinite(message.value)) {
                    throw new Errors.BadRequestError('value is invalid for progress notification');
                }
                progressData = _.pick(message, ['maximum', 'value', 'description']);
            })
            .then(function(){
                return waterline.taskdependencies.findOne({taskId: message.taskId});
            })
            .then(function(task) {
                if (_.isEmpty(_.get(task, 'graphId'))) {
                    throw new Errors.BadRequestError('Cannot find the task for taskId ' + message.taskId); //jshint ignore: line
                }

                return graphProgressService.publishTaskProgress(
                    task.graphId,
                    message.taskId,
                    progressData,
                    {swallowError: false}
                );
            });
    };

    NotificationApiService.prototype.postNodeNotification = function(message) {

        return Promise.try(function() {
                if (!message.nodeId || !_.isString(message.nodeId)) {
                    throw new Errors.BadRequestError('Invalid node ID in query or body');
                }
            })
            .then(function () {
                return waterline.nodes.needByIdentifier(message.nodeId);
            })
            .then(function (node) {
                if(!node) {
                    throw new Errors.BadRequestError('Node not found');
                }
                return eventsProtocol.publishNodeNotification(message.nodeId, message);
            })
            .then(function () {
                return message;
            });
    };

    NotificationApiService.prototype.postBroadcastNotification = function(message) {
        return eventsProtocol.publishBroadcastNotification(message)
            .then(function () {
                return message;
            });
    };

    return new NotificationApiService();
}
