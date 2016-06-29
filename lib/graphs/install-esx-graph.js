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
            _taskTimeout: 3600000, //1 hour
        },
        'firstboot-callback-uri-wait': {
            // Different value than for the completionUri for 'install-os'
            // because we have multiple reboot stages for esx installs
            completionUri: 'renasar-ansible.pub',
            _taskTimeout: 1200000 // 20 minutes
        },
        'installed-callback-uri-wait': {
            // There are multiple reboots (we reboot after %firstboot in
            // the kickstart). Keep track of both before trying to do SSH validation
            completionUri: 'renasar-ansible.pub',
            _taskTimeout: 1200000 // 20 minutes
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
            label: 'firstboot-callback-uri-wait',
            taskName: 'Task.Wait.Completion.Uri',
            waitOn: {
                'install-os': 'succeeded'
            }
        },
        {
            label: 'installed-callback-uri-wait',
            taskName: 'Task.Wait.Completion.Uri',
            waitOn: {
                'firstboot-callback-uri-wait': 'succeeded'
            }
        },
        {
            label: 'validate-ssh',
            taskName: 'Task.Ssh.Validation',
            waitOn: {
                'installed-callback-uri-wait': 'succeeded'
            }
        }
    ]
};
