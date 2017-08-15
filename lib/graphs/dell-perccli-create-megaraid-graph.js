// Copyright 2017, EMC, Inc.

'use strict';
/*jshint multistr: true */

module.exports = {
    friendlyName: 'Create RAID via perccli',
    injectableName: 'Graph.Raid.Create.Perccli',
    options: {
        'bootstrap-ubuntu': {
            overlayfsUri: '{{ api.server }}/common/dell.raid.overlay.cpio.gz'
        },
        'config-raid':{
            hddArr: null,
            ssdStoragePoolArr:null,
            ssdCacheCadeArr:null,
            path:null,
            controller:null
        }
    },
    tasks: [
        {
            ignoreFailure: true,
            label: 'set-boot-pxe',
            taskName: 'Task.Obm.Node.PxeBoot'
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
            label: 'config-raid',
            taskName:'Task.Config.Megaraid',
            waitOn: {
                'bootstrap-ubuntu': 'succeeded'
            },
            ignoreFailure: true
        },
        {
            label: 'refresh-catalog-megaraid',
            taskName: 'Task.Catalog.perccli',
            waitOn: {
                'config-raid': 'succeeded'
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
