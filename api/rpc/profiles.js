// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved
'use strict';

var injector = require('../../index.js').injector;
var profiles = injector.get('Profiles');

var profilesGetLibByName = function (call) {
    return profiles.get(call.request.name,call.request, call.request.scope)
        .then(function(profiles) {
            return profiles.contents;
        });
};

var profilesGetMetadata  = function () {
    return profiles.getAll();
};

var profilesGetMetadataByName  = function (call) {
    return profiles.getName(call.request.name, call.request.scope);
};

var profilesPutLibByName  = function (call) {
    return profiles.put(call.request.name, call.request, call.request.scope);
};

module.exports = {
    profilesGetLibByName:profilesGetLibByName,
    profilesGetMetadata:profilesGetMetadata,
    profilesGetMetadataByName:profilesGetMetadataByName,
    profilesPutLibByName:profilesPutLibByName
};