
// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved.

'use strict';

var di = require('di');

module.exports = nodeApiServiceFactory;
di.annotate(nodeApiServiceFactory, new di.Provide('Http.Services.Api.Nodes'));
di.annotate(nodeApiServiceFactory,
    new di.Inject(
        'Services.Waterline'
    )
);
function nodeApiServiceFactory(
    waterline
) {

    function NodeApiService() {
    }

    /**
     * Get a list of nodes with the tagName applied to them
     * @param  {String}     tagName
     * @return {Promise}    Resolves to an array of nodes
     */
    NodeApiService.prototype.getNodeByIdentifier = function(identifier) {
        return waterline.nodes.findByIdentifier(identifier);
    };

    return new NodeApiService();
}
