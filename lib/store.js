// Copyright 2015, EMC, Inc.
'use strict';

var di = require('di');

module.exports = storeFactory;
di.annotate(storeFactory, new di.Provide('TaskGraph.Store'));
di.annotate(storeFactory,
    new di.Inject(
        'Services.Configuration',
        di.Injector
    )
);
function storeFactory(configuration, injector) {
    var mode = configuration.get('taskgraph-store', 'mongo');
    switch(mode) {
        case 'mongo':
            return injector.get('TaskGraph.Stores.Mongo');
        default:
            throw new Error('Unknown taskgraph store: ' + mode);
    }
}
