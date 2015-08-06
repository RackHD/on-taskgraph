module.exports = {
    friendlyName: 'Install CentOS 7.0',
    injectableName: 'Graph.InstallCentOS70',
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
            waitOn: {
                'reboot': 'succeeded'
            },
            taskDefinition: {
                friendlyName: 'Install CentOS 7.0',
                injectableName: 'Task.Os.Install.CentOS70',
                implementsTask: 'Task.Base.Os.Install',
                options: {
                    username: 'renasar',
                    profile: 'install-centos70.ipxe',
                    hostname: 'renasar-nuc',
                    comport: 'ttyS0',
                    uid: 1010,
                    domain: 'renasar.com',
                    completionUri: 'renasar-ansible.pub'
                },
                properties: {
                    os: {
                        linux: {
                            distribution: 'centos'
                        }
                    }
                }
            }
        }
    ]
};
