module.exports = {
    friendlyName: 'Install Esx',
    injectableName: 'Graph.InstallEsx',
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
            label: 'install-esx',
            taskName: 'Task.Os.Install.Esx',
            waitOn: {
                'reboot': 'succeeded'
            }
        }
    ]
};
