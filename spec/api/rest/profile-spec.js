// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved
/* jshint node:true */

'use strict';

describe('Http.Api.Profile', function () {
    var mockery;
    var profilesApi;
    var profiles;

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
            }, 'Http.Services.Api.Profiles'),
            helper.di.simpleWrapper({
                get: sinon.stub(),
                put: sinon.stub(),
                getAll: sinon.stub(),
                getName: sinon.stub()
            }, 'Profiles')
        ];
        helper.setupInjector(injectables);

        // setup mockery such that index.injector is our test injector.
        mockery = require('mockery');
        mockery.registerMock('../../index.js', { injector: helper.injector });
        mockery.enable({ useCleanCache: true, warnOnUnregistered: false });

        // Now require file to test
        profilesApi = require('../../../api/rest/profiles');
        profiles = helper.injector.get('Profiles');
    });

    var req1 = {
        swagger: {
            params: {
                name: {
                    value:"arista-boot-config"
                },
                scope: {
                    value: "global"
                },
                randomData: 'random data'
            }
        }
    };

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

        it("should GET a Lib profiles", function() {
            var profiles = helper.injector.get('Profiles');
            var returnedProfile  = {contents: "returnedProfile"};
            profiles.get.resolves(returnedProfile);
            return profilesApi.profilesGetLibByName(req1)
                .should.eventually.equal(returnedProfile.contents);
        });

        it("should PUT a Lib profile", function() {
            var returnedPutValue ={
                "createdAt": "2017-09-14T18:18:38.489Z",
                "hash": "w9F3Ve/dOcnhcJBgkGUDZg==",
                "name": "ansible-external-inventory.js",
                "path": "/home/rackhd/git/2rackhd/rackhd/on-taskgraph/data/templates/ansible-external-inventory.js",
                "scope": "global",
                "updatedAt": "2017-09-18T13:19:10.990Z",
                "id": "2d138ac3-0e70-4dee-ae30-b242658bd2a4"
            } ;

            var profiles = helper.injector.get('Profiles');
            profiles.put.resolves(returnedPutValue);
            return profilesApi.profilesPutLibByName(req1)
                .should.eventually.equal(returnedPutValue);
        });


        it("should GET template metadata", function() {
            var metadata =[{
                "id": "e33202fc-f77c-40cc-8bab-037115c1de9a",
                "hash": "2Hmi/YDYFG9CezRfd4xVOA==",
                "name": "renasar-ansible.pub",
                "scope": "global"
            }];
            var profiles = helper.injector.get('Profiles');
            profiles.getAll.resolves(metadata);
            return profilesApi.profilesGetMetadata()
                .should.eventually.equal(metadata);
        });

        it("should GET template metadata by name", function() {
            var metadata =[{
                "id": "e33202fc-f77c-40cc-8bab-037115c1de9a",
                "hash": "2Hmi/YDYFG9CezRfd4xVOA==",
                "name": "renasar-ansible.pub",
                "scope": "global"
            }];
            var profiles = helper.injector.get('Profiles');
            profiles.getName.resolves(metadata);
            return profilesApi.profilesGetMetadataByName(req1)
                .should.eventually.equal(metadata);
        });
    });
});
