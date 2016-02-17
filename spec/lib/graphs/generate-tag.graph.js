// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe(__filename, function () {
    var base = require('./base-graph-spec');

    base.before(function (context) {
        context.taskdefinition = helper.require('/lib/graphs/generate-tag-graph.js');
    });

    describe('graph', function () {
        base.examples();
    });

});
