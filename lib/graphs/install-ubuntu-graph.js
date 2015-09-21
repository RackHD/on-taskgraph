// Copyright 2015, EMC, Inc.

module.exports = {
    friendlyName: 'Install Ubuntu',
    injectableName: 'Graph.InstallUbuntu',
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
        }
    ]
};
