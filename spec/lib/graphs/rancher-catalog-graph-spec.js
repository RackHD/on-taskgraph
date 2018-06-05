// Copyright © 2018 Dell Inc. or its subsidiaries. All Rights Reserved.

'use strict';

describe(require('path').basename(__filename), function () {
    var base = require('./base-graph-spec');

    base.before(function (context) {
        context.taskdefinition = helper.require('/lib/graphs/rancher-catalog-graph.js');
    });

    describe('graph', function () {
        base.examples();
    });
});
