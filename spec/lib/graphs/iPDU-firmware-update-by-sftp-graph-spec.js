//Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved.
/* jshint node:true */

'use strict';

describe(require('path').basename(__filename), function () {
    var base = require('./base-graph-spec');

    base.before(function (context) {
        context.taskdefinition = helper.require(
            '/lib/graphs/examples/iPDU-firmware-update-by-sftp-graph.js'
        );
    });

    describe('graph', function () {
        base.examples();
    });

});
