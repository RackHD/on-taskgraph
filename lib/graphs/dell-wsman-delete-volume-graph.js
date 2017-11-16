// Copyright 2017 Dell Inc. or its subsidiaries. All Rights Reserved.

'use strict';

module.exports = {
    friendlyName: 'Dell Wsman Delete Volume',
    injectableName: 'Graph.Dell.Wsman.Delete.Volume',
    options: {
        defaults: {
            shutdownType: 0,
            verifySSL: false,
            _taskTimeout: 900000,
            domain: 'wsman'
        }
    },
    tasks: [
        {
            label: 'dell-wsman-delete-volume-getComponent',
            taskName: 'Task.Dell.Wsman.Delete.Volume.getComponent'
        },
        {
            label: 'dell-wsman-delete-volume-xml',
            taskName: 'Task.Dell.Wsman.Delete.Volume.Xml',
            waitOn: {
                'dell-wsman-delete-volume-getComponent': 'finished'
            }
        },
        {
            label: 'dell-wsman-RAID',
            taskName: 'Task.Dell.Wsman.RAID',
            waitOn: {
                'dell-wsman-delete-volume-xml': 'finished'
            }
        },
        {
            label: 'dell-wsman-get-inventory',
            taskName: 'Task.Dell.Wsman.GetInventory',
            waitOn: {
                'dell-wsman-RAID': 'finished'
            },
            ignoreFailure: true
        }
    ]
};
