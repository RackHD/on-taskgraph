// Copyright 2016, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'Create Redfish Systems Pollers',
    injectableName: 'Graph.Redfish.Systems.Poller.Create',
    options: {
        defaults: {
            nodeId: null,
            pollers: [
                {
                    "type": "redfish",
                    "pollInterval": 10000,
                    "config": {
                        "command": "logservices"
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
