module.exports = {
    friendlyName: 'Install Ubuntu',
    injectableName: 'Graph.InstallUbuntu',
    tasks: [
        {
            label: 'reboot',
            taskName: 'Task.Obm.Node.Reboot'
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
