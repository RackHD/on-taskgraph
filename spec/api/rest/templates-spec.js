// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved
/* jshint node:true */

'use strict';

describe('Http.Api.Templates', function () {
    var mockery;
    var templatesApi;

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
                templatesGetByName: sinon.stub()
            }, 'Http.Services.Api.Templates')
        ];
        helper.setupInjector(injectables);

        // setup mockery such that index.injector is our test injector.
        mockery = require('mockery');
        mockery.registerMock('../../index.js', { injector: helper.injector });
        mockery.enable({ useCleanCache: true, warnOnUnregistered: false });

        // Now require file to test
        templatesApi = require('../../../api/rest/templates');
    });


    after('disable mockery', function () {
        mockery.deregisterAll();
        mockery.disable();
    });


    describe("GET /templates:name", function() {
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
        var template = "Template Content";
        it("should get template", function() {
            var templatesApiService = helper.injector.get('Http.Services.Api.Templates');
            templatesApiService.templatesGetByName.resolves(template);
            return templatesApi.templatesGetByName(req, res)
                .should.eventually.equal(template);
        });
    });
});
