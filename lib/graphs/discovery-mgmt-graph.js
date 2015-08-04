module.exports = {
    friendlyName: 'Mgmt Discovery',
    injectableName: 'Graph.Mgmt.Discovery',
    tasks: [
        {
            label: 'catalog-mgmt-bmc',
            taskName: 'Task.Catalog.Mgmt.bmc',
            ignoreFailure: true
        }
    ]
};
