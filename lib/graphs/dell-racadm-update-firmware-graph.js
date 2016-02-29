// Copyright 2016, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'Dell Racadm Update Firmware Graph',
    injectableName: 'Graph.Dell.Racadm.Update.Firmware',
    options: {
        defaults: {
            serverUsername: null,
            serverPassword: null,
            serverFilePath: null
        }
    },
    tasks: [
        {
            label: 'dell-racadm-update-firmware',
            taskName: 'Task.Dell.Racadm.Update.Firmware'
        }
    ]
};

