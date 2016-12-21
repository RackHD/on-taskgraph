// Copyright 2015, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'Discovery',
    injectableName: 'Graph.Discovery',
    options: {
        'bootstrap-ubuntu': {
            'triggerGroup': 'bootstrap'
        },
        'finish-bootstrap-trigger': {
            'triggerGroup': 'bootstrap'
        },
        'obm-option' : {
            obmOption: 'false',
            when: '{{options.obmOption}}'
        }
    },
    tasks: [
        {
            label: 'bootstrap-ubuntu',
            taskName: 'Task.Linux.Bootstrap.Ubuntu'
        },
        {
            label: 'catalog-dmi',
            taskName: 'Task.Catalog.dmi'
        },
        {
            label: 'catalog-ohai',
            taskName: 'Task.Catalog.ohai',
            waitOn: {
                'catalog-dmi': 'finished'
            }
        },
        {
            label: 'catalog-bmc',
            taskName: 'Task.Catalog.bmc',
            waitOn: {
                'catalog-ohai': 'finished'
            },
            ignoreFailure: true
        },
        {
            label: 'catalog-lsall',
            taskName: 'Task.Catalog.lsall',
            waitOn: {
                'catalog-bmc': 'finished'
            },
            ignoreFailure: true
        },
        {
            label: 'catalog-megaraid',
            taskName: 'Task.Catalog.megaraid',
            waitOn: {
                'catalog-lsall': 'finished'
            },
            ignoreFailure: true
        },
        {
            label: 'catalog-smart',
            taskName: 'Task.Catalog.smart',
            waitOn: {
                'catalog-megaraid': 'finished'
            },
            ignoreFailure: true
        },
        {
            label: 'catalog-driveid',
            taskName: 'Task.Catalog.Drive.Id',
            waitOn: {
                'catalog-smart': 'finished'
            },
            ignoreFailure: true
        },
        {
            label: 'catalog-lldp',
            taskName: 'Task.Catalog.LLDP',
            waitOn: {
                'catalog-driveid': 'finished'
            },
            ignoreFailure: true
        },
        {
            "label": "set-boot-pxe",
            "taskDefinition": {
                "friendlyName": "Set PXE boot",
                "injectableName": "Task.Node.PxeBoot",
                "implementsTask": "Task.Base.Linux.Commands",
                "options": {
                    "commands": "sudo ipmitool chassis bootdev pxe"
                },
                "properties": {}
            },
            waitOn: {
               'catalog-lldp': 'finished'
            }
        },
        {
            label: 'obm-option',
            taskName: 'Task.Evaluate.Condition',
            waitOn: {
                'set-boot-pxe': 'finished'
            },
            ignoreFailure: true
        },
        {
            label: 'generate-pass',
            taskDefinition: {
                friendlyName: 'Generate BMC Password',
                injectableName: 'Task.Generate.BMC.Password',
                implementsTask: 'Task.Base.Generate.Password',
                properties: { },
                options: {
                    user: null
                }
            },
            waitOn: {
                'obm-option': 'succeeded'
            }
        },
        {
            label: 'set-bmc',
            taskName: 'Task.Set.BMC.Credentials',
            waitOn: {
                'generate-pass': 'succeeded',
                'obm-option': 'succeeded'
            }
        },
        {
            label: 'update-catalog-bmc',
            taskName: 'Task.Catalog.bmc',
            waitOn: {
                'set-bmc': 'succeeded',
                'obm-option': 'succeeded'
            }
        },
        {
            label: 'create-ipmi-obm-settings',
            taskName: 'Task.Obm.Ipmi.CreateSettings',
            waitOn: {
                'update-catalog-bmc': 'succeeded',
                'obm-option': 'succeeded'
            }
        },
        {
            label: 'shell-reboot-post-bmc-settings',
            taskName: 'Task.ProcShellReboot',
            waitOn: {
                'create-ipmi-obm-settings': 'succeeded',
                'obm-option': 'succeeded'
            }
        },
        {
            label: 'shell-reboot',
            taskName: 'Task.ProcShellReboot',
            waitOn: {
                'obm-option': 'failed'
            }
        },
        {
            label: 'finish-bootstrap-trigger',
            taskName: 'Task.Trigger.Send.Finish',
            waitOn: {
                'set-boot-pxe': 'finished'
            }
        },
        {
            label: 'node-discovered-alert-post-bmc',
            taskName: 'Task.Alert.Node.Discovered',
            waitOn: {
                'create-ipmi-obm-settings': 'finished',
                'obm-option': 'succeeded'
            }
        },
        {
            label: 'node-discovered-alert',
            taskName: 'Task.Alert.Node.Discovered',
            waitOn: {
                'shell-reboot': 'finished',
                'obm-option': 'failed'
            }
        }
    ]
};
