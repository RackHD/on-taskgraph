// Copyright 2015, EMC, Inc.

module.exports = {
    friendlyName: 'Install RHEL',
    injectableName: 'Graph.InstallRHEL',
    options: {
        'install-os': {
            version: null,
            repo: '{{api.server}}/rhel/{{options.version}}/os/x86_64',
            schedulerOverrides: {
                timeout: 3600000 //1 hour
            }
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
            taskName: 'Task.Os.Install.CentOS', //RHEL installation shares the same task of CentOS
            waitOn: {
                'reboot': 'succeeded'
            }
        }
    ]
};
