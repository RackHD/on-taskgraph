// Copyright 2015-2016, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'Install Ubuntu',
    injectableName: 'Graph.InstallUbuntu',
    options: {
        "validate-ssh": {
            retries: 10
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
            label: 'install-ubuntu',
            taskName: 'Task.Os.Install.Ubuntu',
            waitOn: {
                'reboot': 'succeeded'
            }
        },
        {
            label: "validate-ssh",
            taskName: "Task.Ssh.Validation",
            waitOn: {
                "install-ubuntu": "succeeded"
            }
        }
    ]
};
