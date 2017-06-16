// Copyright 2017git stat   , EMC, Inc.

'use strict';

describe(require('path').basename(__filename), function () {
    var base = require('./base-graph-spec');

    base.before(function (context) {
        context.taskdefinition = helper.require(
            '/lib/graphs/dell-configure-redfish-alerting-graph.js');
    });

    describe('graph', function () {
        base.examples();
    });
});
