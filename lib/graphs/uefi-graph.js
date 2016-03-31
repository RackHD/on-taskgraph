// Copyright 2016, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'Run a UEFI Application',
    injectableName: 'Graph.RunUefi',
    options: {
        defaults: {
            repo: '{{api.server}}',
            uefitool: 'uefi.efi',
            args: ''
        },
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
            label: 'runuefi',
            taskName: 'Task.Run.Uefi',
            waitOn: {
                'reboot': 'succeeded'
            }
        }
    ]
};
