module.exports = {
    friendlyName: 'Install RHEL',
    injectableName: 'Graph.InstallRHEL',
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
            label: 'install-rhel',
            waitOn: {
                'reboot': 'succeeded'
            },
            taskDefinition: {
                friendlyName: 'Install RHEL',
                injectableName: 'Task.Os.Install.RHEL',
                implementsTask: 'Task.Base.Os.Install',
                options: {
                    username: 'renasar',
                    profile: 'install-rhel70.ipxe',
                    hostname: 'renasar-nuc',
                    comport: 'ttyS0',
                    uid: 1010,
                    domain: 'renasar.com',
                    completionUri: 'renasar-ansible.pub'
                },
                properties: {
                    os: {
                        linux: {
                            distribution: 'rhel'
                        }
                    }
                }
            }
        }
    ]
};
