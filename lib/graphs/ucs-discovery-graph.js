// Copyright 2016, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'Ucs Discovery',
    injectableName: 'Graph.Ucs.Discovery',
    options: {
        defaults: {
            uri: null
        },
        'when-catalog-emc' : {
            autoCatalogEmc: 'false',
            when: '{{options.autoCatalogEmc}}'
        },
        'when-pollers-emc' : {
            autoCreatePollerEmc: 'false',
            when: '{{options.autoCreatePollerEmc}}'
        }
    },
    tasks: [
        {
            'x-description': 'Enumerate the ucs endpoint',
            label: 'ucs-client-discovery',
            taskName: 'Task.Ucs.Discovery'
        }
    ]
};
