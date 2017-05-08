// Copyright 2017, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'Dell WSMAN Get System Configuration Components Catalog Graph',
    injectableName: 'Graph.Dell.Wsman.GetSystemComponentsCatalog',
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
            componentNames: null
        }
    },
    tasks: [
        {
            label: 'dell-wsman-get-systemcomponents',
            taskName: 'Task.Dell.Wsman.GetSystemConfigComponents'
        }
    ]
};
