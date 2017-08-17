// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved
'use strict';

var injector = require('../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var profilesApiService = injector.get('Http.Services.Api.Profiles');

var profilesGet  = controller( function (req, res) {
    return profilesApiService.getProfiles(req, req.swagger.query, res)
        .then(function (render) {
            return profilesApiService.renderProfile(render, req, res);
        });
});

module.exports = {
    profilesGet:profilesGet
};
