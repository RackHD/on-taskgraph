module.exports = {
    friendlyName: 'discovery',
    injectableName: 'Graph.discovery',
    tasks: [
        {
            label: 'bootstrap-ubuntu',
            taskName: 'Task.Linux.Bootstrap.Ubuntu'
        },
        {
            label: 'catalog-dmi',
            taskName: 'Task.Catalog.dmi',
            waitOn: {
                'bootstrap-ubuntu': 'succeeded'
            }
        },
        {
            label: 'catalog-bmc',
            taskName: 'Task.Catalog.bmc',
            waitOn: {
                'catalog-dmi': 'finished'
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
            label: 'shell-reboot',
            taskName: 'Task.ProcShellReboot',
            waitOn: {
                'catalog-megaraid': 'finished'
            }
        }
    ],
};
