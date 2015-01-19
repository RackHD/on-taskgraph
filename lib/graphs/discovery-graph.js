module.exports = {
    friendlyName: 'discovery',
    injectableName: 'Graph.discovery',
    tasks: [
        {
            label: 'bootstrap-ubuntu',
            taskName: 'Task.Linux.Bootstrap.Ubuntu'
        },
        /*
        {
            label: 'catalog-dmi',
            taskName: 'Task.Catalog.dmi',
            waitOn: {
                'bootstrap-ubuntu': 'succeeded'
            }
        }
        */
    ],
};
