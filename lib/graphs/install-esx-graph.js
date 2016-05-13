// Copyright 2015-2016, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'Install Esx',
    injectableName: 'Graph.InstallEsx',
    options: {
        defaults: {
            version: null,
            repo: '{{api.server}}/esxi/{{options.version}}'
        },
        'install-os': {
            schedulerOverrides: {
                timeout: 3600000 //1 hour
            }
        },
        'validate-ssh': {
            retries: 10
        }
    },
    tasks: [
        {
            label: 'analyze-repo',
            taskName: 'Task.Os.Esx.Analyze.Repo',
        },
        {
            label: 'set-boot-pxe',
            taskName: 'Task.Obm.Node.PxeBoot',
            ignoreFailure: true,
            waitOn: {
                'analyze-repo': 'succeeded'
            }
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
        },
        {
            label: 'completion-uri-wait',
            taskName: 'Task.Wait.Completion.Uri',
            waitOn: {
                'install-os': 'succeeded'
            }
        },
        {
            label: "validate-ssh",
            taskName: "Task.Ssh.Validation",
            waitOn: {
                "completion-uri-wait": "succeeded"
            }
        }
    ]
};
