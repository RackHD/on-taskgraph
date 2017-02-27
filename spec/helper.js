// Copyright 2015, EMC, Inc.

'use strict';

require('on-core/spec/helper');

var util = require('util');

var index = require('../index');

// Mocha doesn't read the waterline validation errors because they
// use rawStack instead of stack, so provide a convenience function to pass
// all errors through where there is a chance they could be waterline ones
helper.handleError = function(error) {
    if (error.code === 'E_VALIDATION') {
        throw new Error("Validation error\n" + error.details + "\n" + error.rawStack);
    } else {
        throw error;
    }
};

helper.startServer = function (overrides, endpointOpt) {
    overrides = (overrides || []).concat([
        onHttpContext.helper.simpleWrapper({
            publishLog: sinon.stub().resolves()
        }, 'Protocol.Logging'),
        onHttpContext.helper.simpleWrapper({
            lookupIpLease: sinon.stub().resolves('00:00:00:00:00:00')
        }, 'Protocol.Dhcp')
    ]);

    helper.setupInjector(_.flattenDeep([
        onHttpContext.prerequisiteInjectables,
        onHttpContext.injectables,
        overrides
    ]));

    helper.setupTestConfig();

    helper.injector.get('Services.Configuration')
        .set('enableUPnP', false)
        .set('skuPackRoot', 'spec/lib/services/sku-static')
        .set('httpEndpoints', [ _.merge( {},
            {
                'port': 8089,
                'httpsEnabled': false
            },
            endpointOpt )
        ]);

    index.injector = helper.injector;

    return helper.injector.get('app').start();
};

helper.stopServer = function () {
    return helper.injector.get('app').stop();
};

helper.request = function (url, options) {
    var agent = request(url || 'http://localhost:8089', options);

    // monkeypatch supertest objects to have a "then" function so they can be used as promises
    _.methods(agent).forEach(function (method) {
        var orig = agent[method];
        agent[method] = function () {
            var test = orig.apply(agent, arguments);

            test.then = function (successCallback, errorCallback) {
                var deferred = new Promise(function (resolve, reject) {
                    test.end(function(err, res) {
                        if (err) {
                            // if a status check fails, supertest will pass the res object as well.
                            // so, append some extra verbosity to the error for the report.
                            if (res) {
                                var output = res.body || res.text;
                                err.message +=
                                    '\nResponse body:\n'+
                                    util.inspect(output) +
                                    '\n' + err.stack;
                            }
                            reject(err);
                            return;
                        } else {
                            resolve(res);
                        }
                    });
                });

                return deferred.then(successCallback, errorCallback);
            };
            return test;
        };
    });

    return agent;
};
