// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved
'use strict';

var injector = require('../../index.js').injector;
var controller = injector.get('Http.Services.Swagger').controller;
var templatesApiService = injector.get('Http.Services.Api.Templates');

var templatesGetByName  = controller( function (req, res) {
    return templatesApiService.templatesGetByName(req, res);
});

module.exports = {
    templatesGetByName:templatesGetByName
};
