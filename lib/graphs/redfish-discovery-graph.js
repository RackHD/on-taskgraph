// Copyright 2016, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'Redfish Discovery',
    injectableName: 'Graph.Redfish.Discovery',
    options: {
        defaults: {
            uri: null
        },
        'when-catalog-emc' : {
            autoCatalogEmc: 'false',
            when: '{{options.autoCatalogEmc}}',
        }
    },
    tasks: [
        {
            'x-description': 'Enumerate the redfish endpoint',
            label: 'redfish-client-discovery',
            taskName: 'Task.Redfish.Discovery',
        },
        {
            'x-description': 'Indicate to downstream tasks if cataloging should be done',
            label: 'when-catalog-emc',
            taskName: 'Task.Evaluate.Condition',
            waitOn: {
                'redfish-client-discovery': 'succeeded'
            }
        },
        {
            'x-description': 'Perform cataloging of the EMC endpoints placed into the graph context',
            label: 'emc-redfish-catalog',
            taskName: 'Task.Emc.Redfish.Catalog',
            waitOn: {
                'when-catalog-emc': 'succeeded'
            },
            ignoreFailure: true
        },
        {
            'x-description': 'Set the final graph state to success when cataloging is skipped',
            label: 'noop',
            taskName: 'Task.noop',
            waitOn: {
                'when-catalog-emc': 'failed'
            }
        }
    ]
};
