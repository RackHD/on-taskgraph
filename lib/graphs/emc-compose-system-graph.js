// Copyright 2016, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'EMC Compose System Graph',
    injectableName: 'Graph.Emc.Compose.System',
    options: {
        defaults: {
            endpoints: null,
            name: null,
            action: 'compose' // 'compose', 'recompose', 'destroy'
        }
    },
    tasks: [
        {
            label: 'emc-compose-system',
            taskName: 'Task.Emc.Compose.System'
        }
    ]
};
