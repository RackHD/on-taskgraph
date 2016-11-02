// Copyright 2016, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'Dell wsman Update Firmware Graph',
    injectableName: 'Graph.Dell.Wsman.Update.Firmware',
    options: {
        defaults: {
            serverUsername: null,
            serverPassword: null,
            serverFilePath: null
        }
    },
    tasks: [
        {
            label: 'dell-wsman-update-firmware',
            taskName: 'Task.Dell.Wsman.Update.Firmware'
        }
    ]
};

