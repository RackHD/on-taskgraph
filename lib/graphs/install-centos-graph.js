module.exports = {
    friendlyName: 'Install CentOS',
    injectableName: 'Graph.InstallCentOS',
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
            label: 'install-centos',
            taskName: 'Task.Os.Install.CentOS',
            waitOn: {
                'reboot': 'succeeded'
            }
        }
    ],
};
