module.exports = {
    friendlyName: 'Install CentOS',
    injectableName: 'Graph.InstallCentOS',
    tasks: [
        {
            label: 'reboot',
            taskName: 'Task.Obm.Node.Reboot'
        },
        {
            label: 'install-centos',
            taskName: 'Task.Linux.Install.CentOS',
            waitOn: {
                'reboot': 'succeeded'
            }
        }
    ],
};
