module.exports = {
    friendlyName: 'Install CoreOS',
    injectableName: 'Graph.InstallCoreOS',
    tasks: [
        {
            label: 'reboot',
            taskName: 'Task.Obm.Node.Reboot'
        },
        {
            label: 'install-coreos',
            taskName: 'Task.Linux.Install.CoreOS',
            waitOn: {
                'reboot': 'succeeded'
            }
        }
    ],
};
