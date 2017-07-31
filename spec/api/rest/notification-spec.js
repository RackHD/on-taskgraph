// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved
/* jshint node:true */

'use strict';

describe('Http.Api.Notification', function () {
    var mockery;
    var notificationApi;

    var nodeNotificationMessage = {
        nodeId: '57a86b5c36ec578876878294',
        randomData: 'random data'
    };

    before('setup mockery', function () {
        this.timeout(10000);

        // setup injector with mock override injecatbles
        var injectables = [
            helper.di.simpleWrapper({
                controller: function(opts, cb) {
                    if (typeof(opts) === 'function') {
                        cb = opts;
                    }
                    return cb;
                }
            }, 'Http.Services.Swagger'),
            helper.di.simpleWrapper({
                postNotification: sinon.stub(),
                publishTaskProgress: sinon.stub()
            }, 'Http.Services.Api.Notification')
        ];
        helper.setupInjector(injectables);

        // setup mockery such that index.injector is our test injector.
        mockery = require('mockery');
        mockery.registerMock('../../index.js', { injector: helper.injector });
        mockery.enable({ useCleanCache: true, warnOnUnregistered: false });

        // Now require file to test
        notificationApi = require('../../../api/rest/notification');
    });


    after('disable mockery', function () {
        mockery.deregisterAll();
        mockery.disable();
    });

    // Since sinon.stub() has no returnsArg method, add a Promise wrapper.
    // This will allow a stub to return a promise resolving to one of its call
    // arguments.
    function _stubPromiseWrapper(stub) {
        return function() {
            return Promise.resolve(stub.apply(sinon, arguments));
        };
    }

    describe("POST /notification", function() {
        beforeEach(function() {
            var notificationApiService = helper.injector.get('Http.Services.Api.Notification');
            notificationApiService.postNotification = sinon.stub();
            notificationApiService.publishTaskProgress = sinon.stub();
        });

        it("should post a notification", function() {
            var req = {
                swagger: {
                    query: {
                        nodeId: '57a86b5c36ec578876878294',
                        randomData: 'random data'
                    }
                }
            };
            var res = {
                locals: {
                    ipAddress: "0.0.0.0"
                }
            };
            var _nodeNotificationMessage = _.cloneDeep(nodeNotificationMessage);
            _nodeNotificationMessage.nodeIp = '127.0.0.1';
            var notificationApiService = helper.injector.get('Http.Services.Api.Notification');
            notificationApiService.postNotification = _stubPromiseWrapper(sinon.stub().returnsArg(0));
            return notificationApi.notificationPost(req, res)
                .then(function(body) {
                    expect(body).to.deep.equal({
                        "nodeId": "57a86b5c36ec578876878294",
                        "nodeIp": "0.0.0.0",
                        "randomData": "random data",
                    });
                });
        });
    });

    describe("POST /notificationPrograss", function() {
        beforeEach(function() {
            var notificationApiService = helper.injector.get('Http.Services.Api.Notification');
            notificationApiService.publishTaskProgress = sinon.stub();
        });

        it("should post notification progress", function() {
            var req = {
                swagger: {
                    query: {
                        nodeId: '57a86b5c36ec578876878294',
                        randomData: 'random data'
                    }
                }
            };
            var res = {
                locals: {
                    ipAddress: "0.0.0.0"
                },
                send : sinon.stub()
            };
            var _nodeNotificationMessage = _.cloneDeep(nodeNotificationMessage);
            _nodeNotificationMessage.nodeIp = '127.0.0.1';
            var notificationApiService = helper.injector.get('Http.Services.Api.Notification');
            notificationApiService.publishTaskProgress = _stubPromiseWrapper(sinon.stub().returnsArg(0));
            return notificationApi.notificationProgressPost(req, res);
        });
    });
});
