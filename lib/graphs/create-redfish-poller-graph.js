// Copyright 2016, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'Create Redfish Pollers',
    injectableName: 'Graph.Redfish.Poller.Create',
    options: {
        defaults: {
            nodeId: null,
            pollers: [
                {
                    "type": "redfish",
                    "pollInterval": 10000,
                    "config": {
                        "command": "thermal"
                    }
                },
                {
                    "type": "redfish",
                    "pollInterval": 10000,
                    "config": {
                        "command": "power"
                    }
                }
            ]
        }
    },
    tasks: [
        {   
            label: 'create-redfish-pollers',
            taskName: 'Task.Pollers.CreateDefault'
        }
    ]
};
