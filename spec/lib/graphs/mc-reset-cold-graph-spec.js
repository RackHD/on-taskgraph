// Copyright (c) 2015, EMC Corporation

'use strict';

describe('MC Reset Cold', function () {
    var base = require('./base-graph-spec');

    base.before(function (context) {
        context.taskdefinition = helper.require('/lib/graphs/mc-reset-cold-graph.js');
    });

    describe('graph', function () {
        base.examples();
    });

});
