module.exports = {
    friendlyName: 'Install Esx',
    injectableName: 'Graph.InstallEsx',
    options: {
        'install-os': {
            version: '5.5',
            repo: '{{api.server}}/esxi/{{options.version}}'
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
            label: 'install-os',
            taskName: 'Task.Os.Install.Esx',
            waitOn: {
                'reboot': 'succeeded'
            }
        }
    ]
};
