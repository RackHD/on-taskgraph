// Copyright 2017, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'Ucs Discovery',
    injectableName: 'Graph.Ucs.Discovery',
    options: {
        defaults: {
            uri: null
        },
        'when-catalog-ucs' : {
            autoCatalogUcs: 'true',
            when: '{{options.autoCatalogUcs}}'
        },
        'when-pollers-ucs' : {
            autoCreatePollerUcs :'false',
            when: '{{options.autoCreatePollerUcs}}'
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
