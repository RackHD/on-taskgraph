// Copyright 2016, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'Secure Erase Drive',
    injectableName: 'Graph.Drive.SecureErase',
    options: {
        'bootstrap-ubuntu': {
            overlayfsFile: "secure.erase.overlay.cpio.gz",
            triggerGroup: 'secureErase'
        },
        'drive-secure-erase': {
            eraseSettings: null
        },
        'finish-bootstrap-trigger': {
            triggerGroup: 'secureErase'
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
            label: 'drive-secure-erase',
            taskName: 'Task.Drive.SecureErase',
            waitOn: {
                'reboot': 'succeeded'
            }
        },
        {
            label: 'catalog-megaraid',
            taskName: 'Task.Catalog.megaraid',
            waitOn: {
                'drive-secure-erase': 'succeeded'
            },
            ignoreFailure: true
        },
        {
            label: 'catalog-driveid',
            taskName: 'Task.Catalog.Drive.Id',
            waitOn: {
                'catalog-megaraid': 'finished'
            },
            ignoreFailure: true
        },
        {
            label: 'shell-reboot',
            taskName: 'Task.ProcShellReboot',
            waitOn: {
                'catalog-driveid': 'finished'
            }
        },
        {
            label: 'finish-bootstrap-trigger',
            taskName: 'Task.Trigger.Send.Finish',
            waitOn: {
                'catalog-driveid': 'finished'
            }
        }
    ]
};
