// Copyright 2016, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'Redfish Discovery',
    injectableName: 'Graph.Redfish.Discovery',
    options: {
        defaults: {
            uri: null
        }
    },
    tasks: [
        {
            label: 'redfish-client-discovery',
            taskName: 'Task.Redfish.Discovery'
        }
    ]
};
