// Copyright 2015, EMC, Inc.

module.exports = {
    friendlyName: 'Flash MegaRAID controller',
    injectableName: 'Graph.Flash.LSI.MegaRAID',
    options: {
        defaults: {
            file: null,
            downloadDir: '/opt/downloads'
        },
        'flash-firmware': {
            'adapter': '0'
        }
    },
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
            label: 'download-firmware',
            taskName: 'Task.Linux.DownloadFiles',
            waitOn: {
                'bootstrap-ubuntu': 'succeeded'
            }
        },
        {
            label: 'catalog-megaraid-before',
            taskName: 'Task.Catalog.Megaraid',
            waitOn: {
                'download-firmware': 'succeeded'
            }
        },
        {
            label: 'flash-firmware',
            taskName: 'Task.Linux.Flash.LSI.MegaRAID',
            waitOn: {
                'catalog-megaraid-before': 'succeeded'
            }
        },
        {
            label: 'catalog-megaraid-after',
            taskName: 'Task.Catalog.Megaraid',
            waitOn: {
                'flash-firmware': 'succeeded'
            }
        },
        {
            label: 'final-reboot',
            taskName: 'Task.Obm.Node.Reboot',
            waitOn: {
                'catalog-megaraid-after': 'finished'
            }
        }
    ]
};
