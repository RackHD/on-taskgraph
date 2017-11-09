// Copyright 2016, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'Dell wsman Update Firmware Graph',
    injectableName: 'Graph.Dell.Wsman.Update.Firmware',
    options: {
        shareFolderAddress: null,
        shareFolderType: null,
        shareFolderName: null
    },
    tasks: [
        {
            label: 'dell-wsman-update-firmware',
            taskName: 'Task.Dell.Wsman.Update.Firmware'
        }
    ]
};




