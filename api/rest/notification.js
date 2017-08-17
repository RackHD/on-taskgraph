// Copyright 2017, EMC Inc.

'use strict';

var injector = require('../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var notificationApiService = injector.get('Http.Services.Api.Notification');
var _ = injector.get('_');    // jshint ignore:line

var notificationPost = controller({success: 201}, function(req, res) {
    var message = _.defaults(req.swagger.query || {}, req.query || {}, req.body || {});
    message.nodeIp = res.locals.ipAddress;
    return notificationApiService.postNotification(message);
});

/**
 * @api {post} /api/2.0/notification/progress
 * @apiDescription deeply customized notification for task progress
 *  :taskId: active (OS installation) taskId
 *  :maximum: the maximum progress value
 *  :value: the current progress value
 * @apiName notification post
 * @apiGroup notification
 */
var notificationProgressPost = controller(function(req, res){
    var message = _.defaults(req.swagger.query || {}, req.query || {}, req.body || {});
    return notificationApiService.publishTaskProgress(message)
        .then(function(){
            //Send any feedback is OK, just to cheat ipxe engine
            res.send('Notification response, no file will be sent');
        });
});

module.exports = {
    notificationPost: notificationPost,
    notificationProgressPost: notificationProgressPost
};
