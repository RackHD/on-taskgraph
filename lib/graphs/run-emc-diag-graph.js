// Copyright 2016, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'Run EMC Diagnostics',
    injectableName: 'Graph.Run.Emc.Diag',
    options: {
        'bootstrap-emc-diag': {
            'completionPath': '/api/common/templates/renasar-ansible.pub'
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
            label: 'bootstrap-emc-diag',
            taskName: 'Task.Os.Run.Emc.Diag',
            waitOn: {
                'reboot-start': 'succeeded'
            }
        }
    ]
};
