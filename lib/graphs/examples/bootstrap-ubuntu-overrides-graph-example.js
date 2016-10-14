// Copyright 2015, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'Bootstrap Ubuntu',
    injectableName: 'Graph.BootstrapUbuntu',
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
            },
            optionOverrides: {
                overlayfsFile: 'overlayfs_all_files.trusty.MOCKS.cpio.gz'
            }
        }
    ]
};
