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
            label: 'install-coreos',
            taskName: 'Task.Linux.Install.Ubuntu',
            waitOn: {
                'reboot': 'succeeded'
            }
        }
    ],
};
