// Copyright 2015, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'Install Windows Server 2012',
    injectableName: 'Graph.InstallWindowsServer2012',
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
            label: 'bootstrap-winpe',
            taskName: 'Task.WinPE.Bootstrap',
            waitOn: {
                'reboot': 'succeeded'
            }
        },
        {
            label: 'install-os',
            taskName: 'Task.Os.Install.Win',
            waitOn: {
                'reboot': 'succeeded'
            }
        }
    ]
};

