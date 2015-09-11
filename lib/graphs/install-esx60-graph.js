module.exports = {
    friendlyName: 'Install ESXi6.0',
    injectableName: 'Graph.InstallEsx60',
    options: {
        'install-os': {
            version: '6.0',
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
            waitOn: {
                'reboot': 'succeeded'
            },
            taskDefinition: {
                friendlyName: 'Install Esx60',
                injectableName: 'Task.Os.Install.Esx60',
                implementsTask: 'Task.Base.Os.Install',
                options: {
                    profile: 'install-esx60.ipxe',
                    completionUri: 'esx60-ks',
                    esxBootConfigTemplate: 'esx60-boot-cfg-hybrid',
                    comport: 'com1',
                    comportaddress: '0x3f8', //com1=0x3f8, com2=0x2f8, com3=0x3e8, com4=0x2e8
                    version: '6.0', 
                    repo: '{{api.server}}/esxi/{{options.version}}'
                },
                properties: {
                    os: {
                        linux: {
                            distribution: 'esx'
                        }
                    }
                }
            }
        }
    ]
};
