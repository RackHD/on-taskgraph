// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved
'use strict';

var injector = require('../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var profilesApiService = injector.get('Http.Services.Api.Profiles');
var profiles = injector.get('Profiles');

var profilesGet  = controller( function (req, res) {
    return profilesApiService.getProfiles(req, req.swagger.query, res)
        .then(function (render) {
            return profilesApiService.renderProfile(render, req, res);
        });
});

var profilesGetLibByName  = controller( function (req) {
    return profiles.get(req.swagger.params.name.value, req.swagger.params.scope.value)
        .then(function(profiles) {
            return profiles.contents;
        });
});

var profilesGetMetadata  = controller( function () {
    return profiles.getAll();
});

var profilesPutLibByName  = controller( function (req) {
    return profiles.put(req.swagger.params.name.value, req, req.swagger.params.scope.value);
});

var profilesGetMetadataByName  = controller( function (req) {
    return profiles.getName(req.swagger.params.name.value, req.swagger.params.scope.value);
});

// POST /api/2.0/profiles/switch/error/
var profilesPostSwitchError  = controller( function (req) {
    return profilesApiService.postProfilesSwitchError(req.body);
});

// GET /api/2.0/profiles/switch/:vendor
var profilesGetSwitchVendor  = controller( function (req, res) {
    var requestIp = req.get("X-Real-IP") || req.connection._peername.address;
    return profilesApiService.getProfilesSwitchVendor(
        requestIp, req.swagger.params.vendor.value)
        .then (function(render) {
            return profilesApiService.renderProfile(render, req, res);
        });
});




module.exports = {
    profilesGet:profilesGet,
    profilesGetLibByName:profilesGetLibByName,
    profilesGetMetadata:profilesGetMetadata,
    profilesGetMetadataByName:profilesGetMetadataByName,
    profilesPostSwitchError:profilesPostSwitchError,
    profilesGetSwitchVendor:profilesGetSwitchVendor,
    profilesPutLibByName:profilesPutLibByName
};
