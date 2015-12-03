// Copyright 2015, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'Delete RAID via Storcli',
    injectableName: 'Graph.Raid.Delete.MegaRAID',
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
            label: 'delete-raid',
            taskName: 'Task.Raid.Delete.MegaRAID',
            waitOn: {
                'bootstrap-ubuntu': 'succeeded'
            }
        },
        {
            label: 'refresh-catalog-megaraid',
            taskName: 'Task.Catalog.megaraid',
            waitOn: {
                'delete-raid': 'succeeded'
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
