// Copyright 2017, EMC, Inc.
/* jshint node:true */

'use strict';

describe(require('path').basename(__filename), function () {
    var base = require('./base-graph-spec');

    base.before(function (context) {
            context.taskdefinition =
                helper.require('/lib/graphs/ucs-service-profile-discovery-graph.js');
        });

    describe('graph', function () {
            base.examples();
        });

});
