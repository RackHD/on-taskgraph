// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved
/* jshint node:true */

'use strict';

describe('Http.Api.Profile', function () {
    var mockery;
    var profilesApi;

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
                getProfiles: sinon.stub(),
                renderProfile: sinon.stub()
            }, 'Http.Services.Api.Profiles')
        ];
        helper.setupInjector(injectables);

        // setup mockery such that index.injector is our test injector.
        mockery = require('mockery');
        mockery.registerMock('../../index.js', { injector: helper.injector });
        mockery.enable({ useCleanCache: true, warnOnUnregistered: false });

        // Now require file to test
        profilesApi = require('../../../api/rest/profiles');
    });


    after('disable mockery', function () {
        mockery.deregisterAll();
        mockery.disable();
    });


    describe("GET /profiles", function() {
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
        var profile = "redirect.ipxe";
        it("should get bootstrap", function() {
            var profilesApiService = helper.injector.get('Http.Services.Api.Profiles');
            profilesApiService.getProfiles.resolves(req, req.swagger.query);
            profilesApiService.renderProfile.resolves(profile);
            return profilesApi.profilesGet(req, res)
                .should.eventually.equal(profile);
        });
    });
});
