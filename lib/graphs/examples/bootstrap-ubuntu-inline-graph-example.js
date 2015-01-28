module.exports = {
    friendlyName: 'Bootstrap Ubuntu',
    injectableName: 'Graph.BootstrapUbuntu',
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
            label: 'bootstrap-ubuntu',
            waitOn: {
                'reboot': 'succeeded'
            },
            taskDefinition: {
                friendlyName: 'Bootstrap Ubuntu',
                injectableName: 'Task.Linux.Bootstrap.Ubuntu',
                implementsTask: 'Task.Base.Linux.Bootstrap',
                options: {
                    kernelversion: 'vmlinuz-3.13.0-32-generic',
                    kernel: 'common/vmlinuz-3.13.0-32-generic',
                    initrd: 'common/initrd.img-3.13.0-32-generic',
                    basefs: 'common/base.trusty.3.13.0-32.squashfs.img',
                    overlayfs: 'common/overlayfs_all_files.cpio.gz',
                    profile: 'linux.ipxe'
                },
                properties: {
                    os: {
                        linux: {
                            distribution: 'ubuntu',
                            release: 'trusty',
                            kernel: '3.13.0-32-generic'
                        }
                    }
                }
            }
        }
    ]
};
