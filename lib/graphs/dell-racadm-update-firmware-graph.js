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
        },
        'catalog-dmi': {
            updateExistingCatalog: true
        },
        'catalog-bmc': {
            updateExistingCatalog: true
        }
    },
    tasks: [
        {
            label: 'dell-racadm-update-firmware',
            taskName: 'Task.Dell.Racadm.Update.Firmware'
        },
        {
            label: 'bootstrap-ubuntu',
            taskName: 'Task.Linux.Bootstrap.Ubuntu',
            waitOn: {
                'dell-racadm-update-firmware': 'succeeded'
            }
        },
        {
            label: 'catalog-dmi',
            taskName: 'Task.Catalog.dmi',
            waitOn: {
                'bootstrap-ubuntu': 'succeeded'
            }
        },
        {
            label: 'catalog-bmc',
            taskName: 'Task.Catalog.bmc',
            waitOn: {
                'catalog-dmi': 'succeeded'
            }
        }
    ]
};
