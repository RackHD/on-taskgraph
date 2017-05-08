// Copyright 2017, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'Dell WSMAN Update System Configuration Components',
    injectableName: 'Graph.Dell.Wsman.UpdateSystemComponents',
    options: {
        defaults: {
            serverIP: null,
            serverUsername: null,
            serverPassword: null,
            shareType: null,
            shareAddress: null,
            shareName: null,
            fileName: null,
            shutdownType: null,
            serverComponents: null
        }
    },
    tasks: [
        {
            label: 'dell-wsman-update-systemcomponents',
            taskName: 'Task.Dell.Wsman.UpdateSystemConfigComponents'
        }
    ]
};
