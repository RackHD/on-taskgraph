// Copyright 2016, EMC, Inc.

'use strict';
/*jshint multistr: true */

module.exports = {
    friendlyName: 'Bootstrap and Decommission a node',
    injectableName: 'Graph.Bootstrap.Decommission.Node',
    options: {
        'shell-commands': {
            commands:[
                { 
                  command: "for disk in `lsblk | grep disk | awk '{print $1}'`;\
                    do sudo dd if=/dev/zero of=/dev/$disk bs=512 count=1 ; done"
                }
            ]
        },
        'when-secure-erase' : {
            useSecureErase: 'false',
            when: '{{options.useSecureErase}}'
        },
        'remove-bmc-credentials': {
            users: null
        },
        'bootstrap-ubuntu': {
            overlayfs: "common/secure.erase.overlay.cpio.gz",
            triggerGroup: 'secureErase'
        },
        'drive-secure-erase': {
            eraseSettings: null
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
            label: 'remove-bmc-credentials',
            taskName: 'Task.Remove.BMC.Credentials',
            waitOn: {
                'bootstrap-ubuntu': 'succeeded'
            }
        },
        {
            label: 'when-secure-erase',
            taskName: 'Task.Evaluate.Condition',
            waitOn: {
                'remove-bmc-credentials': 'finished'
            }
        },
        {
            label: 'catalog-megaraid',
            taskName: 'Task.Catalog.megaraid',
            waitOn: {
                'remove-bmc-credentials': 'finished'
            },
            ignoreFailure: true
        },
        {
            label: 'catalog-driveid',
            taskName: 'Task.Catalog.Drive.Id',
            waitOn: {
                'remove-bmc-credentials': 'finished'
            },
            ignoreFailure: true
        },
        {
            label: 'shell-commands',
            taskName: 'Task.Linux.Commands',
            waitOn: {
                'when-secure-erase': 'failed'
            }
        },
        {
            label: 'drive-secure-erase',
            taskName: 'Task.Drive.SecureErase',
            waitOn: {
                'when-secure-erase': 'succeeded'
            }
        },
        {
            label: 'catalog-megaraid',
            taskName: 'Task.Catalog.megaraid',
            waitOn: {
                'drive-secure-erase': 'finished'
            },
            ignoreFailure: true
        },
        {
            label: 'catalog-driveid',
            taskName: 'Task.Catalog.Drive.Id',
            waitOn: {
                'drive-secure-erase': 'finished'
            },
            ignoreFailure: true
        },
        {
            label: 'reboot-after-shell-commands',
            taskName: 'Task.ProcShellReboot',
            waitOn: {
                'shell-commands': 'finished'
            }
        },
        {
            label: 'reboot-after-drive-secure-erase',
            taskName: 'Task.ProcShellReboot',
            waitOn: {
                'drive-secure-erase': 'finished'
            }
        },
        {
            label: 'finish-after-shell-commands',
            taskName: 'Task.Trigger.Send.Finish',
            waitOn: {
                'shell-commands': 'finished'
            }
        },
        {
            label: 'finish-after-drive-secure-erase',
            taskName: 'Task.Trigger.Send.Finish',
            waitOn: {
                'drive-secure-erase': 'finished'
            }
        }

    ]
};
