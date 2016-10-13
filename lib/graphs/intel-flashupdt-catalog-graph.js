// Copyright 2015, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'Intel Flashupdt Info',
    injectableName: 'Graph.Catalog.Intel.Flashupdt',
    options: {
        'bootstrap-ubuntu': {
            overlayfsFile: 'overlayfs_intel_flashupdt_syscfg-v1.1-3.13.0-32.cpio.gz'
        }
    },
    tasks: [
        {
            label: 'set-boot-pxe',
            taskName: 'Task.Obm.Node.PxeBoot',
            ignoreFailure: true
        },
        {
            label: 'reboot-start',
            taskName: 'Task.Obm.Node.Reboot',
            waitOn: {
                'set-boot-pxe': 'finished'
            }
        },
        {
            label: 'bootstrap-ubuntu',
            taskName: 'Task.Linux.Bootstrap.Ubuntu',
            waitOn: {
                'reboot-start': 'succeeded'
            }
        },
        {
            label: 'catalog-flashupdt',
            taskName: 'Task.Catalog.flashupdt',
            waitOn: {
                'bootstrap-ubuntu': 'succeeded'
            },
            ignoreFailure: true
        },
        {
            label: 'shell-reboot',
            taskName: 'Task.ProcShellReboot',
            waitOn: {
                'catalog-flashupdt': 'finished'
            }
        }
    ]
};
