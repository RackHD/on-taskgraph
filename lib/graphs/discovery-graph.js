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
            label: 'shell-reboot',
            taskName: 'Task.ProcShellReboot',
            waitOn: {
                'catalog-lldp': 'finished'
            }
        },
        {
            label: 'finish-bootstrap-trigger',
            taskName: 'Task.Trigger.Send.Finish',
            waitOn: {
                'catalog-lldp': 'finished'
            }
        }
    ]
};
