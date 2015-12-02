// Copyright 2015, EMC, Inc.

'use strict';

describe(require('path').basename(__filename), function () {
    var base = require('./base-graph-spec');

    base.before(function (context) {
        context.taskdefinition = helper.require('/lib/graphs/create-megaraid-graph.js');
    });

    describe('graph', function () {
        base.examples();
    });
});
