// Copyright 2017, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'Ucs Service Profile Discovery',
    injectableName: 'Graph.Ucs.Service.Profile.Discovery',
    options: {
        defaults: {
            uri: null
        },
        'when-catalog-ucs' : {
            autoCatalogUcs: 'false',
            when: '{{options.autoCatalogUcs}}'
        },
        'when-pollers-ucs' : {
            autoCreatePollerUcs :'false',
            when: '{{options.autoCreatePollerUcs}}'
        }
    },
    tasks: [
        {
            'x-description': 'Enumerate the ucs service profile',
            label: 'ucs-service-profile-discovery',
            taskName: 'Task.Ucs.Service.Profile.Discovery'
        }
    ]
};
