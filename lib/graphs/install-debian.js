// Copyright 2017, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'Install Debian',
    injectableName: 'Graph.InstallDebian',
    options: {
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
            label: 'install-debian',
            taskName: 'Task.Os.Install.Debian',
            waitOn: {
                'reboot': 'succeeded'
            }
        },
        {
            label: 'rackhd-callback-notification-wait',
            taskName: 'Task.Wait.Notification',
            waitOn: {
                'install-debian': 'succeeded'
            }
        }
    ]
};

