// Copyright 2016, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'Install SUSE',
    injectableName: 'Graph.InstallSUSE',
    options: {
        defaults: {
            version: null,
            repo: '{{api.server}}/distribution/{{options.version}}/repo/oss/'
        },
        'install-os': {
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
            taskName: 'Task.Os.Install.SUSE',
            waitOn: {
                'reboot': 'succeeded'
            }
        }
    ]
};
