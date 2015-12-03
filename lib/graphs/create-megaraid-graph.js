// Copyright 2015, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'Create RAID via Storcli',
    injectableName: 'Graph.Raid.Create.MegaRAID',
    tasks: [
        {
            label: 'set-boot-pxe',
            taskName: 'Task.Obm.Node.PxeBoot',
            ignoreFailure: true
        },
        {
            label: 'reboot',
            taskName: 'Task.Obm.Node.Reboot',
            waitOn: {
                'set-boot-pxe': 'finished'
            }
        },
        {
            label: 'bootstrap-ubuntu',
            taskName: 'Task.Linux.Bootstrap.Ubuntu',
            waitOn: {
                'reboot': 'succeeded'
            }
        },
        {
            label: 'create-raid',
            taskName: 'Task.Raid.Create.MegaRAID',
            waitOn: {
                'bootstrap-ubuntu': 'succeeded'
            }
        },
        {
            label: 'refresh-catalog-megaraid',
            taskName: 'Task.Catalog.megaraid',
            waitOn: {
                'create-raid': 'succeeded'
            }
        },
        {
            label: 'final-reboot',
            taskName: 'Task.Obm.Node.Reboot',
            waitOn: {
                'refresh-catalog-megaraid': 'finished'
            }
        }
    ]
};
