// Copyright 2015, EMC, Inc.

module.exports = {
    friendlyName: 'Mgmt Discovery',
    injectableName: 'Graph.Mgmt.Discovery',
    tasks: [
        {
            label: 'catalog-mgmt-bmc',
            taskName: 'Task.Catalog.Mgmt.bmc',
            ignoreFailure: true
        },
        {
            label: 'catalog-mgmt-lldp',
            taskName: 'Task.Catalog.Local.LLDP',
            ignoreFailure: true
        },
        {
            label: 'catalog-mgmt-dmi',
            taskName: 'Task.Catalog.Local.DMI',
            ignoreFailure: true
        }
    ]
};
