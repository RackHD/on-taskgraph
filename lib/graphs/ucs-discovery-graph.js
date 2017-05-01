// Copyright 2017, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'Ucs Discovery',
    injectableName: 'Graph.Ucs.Discovery',
    options: {
        defaults: {
            uri: null
        },
        'when-discover-physical-ucs' : {
            discoverPhysicalServers: 'true',
            when: '{{options.discoverPhysicalServers}}'
        },
        'when-discover-logical-ucs' : {
            discoverLogicalServer: 'true',
            when: '{{options.discoverLogicalServer}}'
        },
        'when-catalog-ucs' : {
            autoCatalogUcs: 'true',
            when: '{{options.autoCatalogUcs}}'
        }
    },
    tasks: [
        {
            'x-description': 'Check to see if we need to discover physical UCS servers',
            label: 'when-discover-physical-ucs',
            taskName: 'Task.Evaluate.Condition',
            ignoreFailure: true
        },
        {
            'x-description': 'Check to see if we need to discover logical UCS servers',
            label: 'when-discover-logical-ucs',
            taskName: 'Task.Evaluate.Condition',
            ignoreFailure: true,
        },
        {
            'x-description': 'Discover physical UCS servers',
            label: 'ucs-physical-discovery',
            taskName: 'Task.Ucs.Discovery',
            waitOn: {
                'when-discover-physical-ucs': 'succeeded'
            }
        },
        {
            'x-description': 'Discover logical UCS servers',
            label: 'ucs-logical-discovery',
            taskName: 'Task.Ucs.Service.Profile.Discovery',
            waitOn: {
                'when-discover-logical-ucs': 'succeeded'
            }
        },
        {
            'x-description': 'UCS physical discovery finished',
            label: 'ucs-physical-discovery-done',
            taskName: 'Task.noop',
            waitOn: {
                anyOf: {
                    'when-discover-physical-ucs': 'failed',
                    'ucs-physical-discovery': 'succeeded'
                }
            }
        },
        {
            'x-description': 'UCS logical discovery finished',
            label: 'ucs-logical-discovery-done',
            taskName: 'Task.noop',
            waitOn: {
                anyOf: {
                    'when-discover-logical-ucs': 'failed',
                    'ucs-logical-discovery': 'succeeded'
                }
            }
        },
        {
            'x-description': 'Check to see if cataloging should be done',
            label: 'when-catalog-ucs',
            taskName: 'Task.Evaluate.Condition',
            waitOn: {
                'ucs-physical-discovery-done': 'succeeded',
                'ucs-logical-discovery-done': 'succeeded'
            },
            ignoreFailure: true
        },
        {
            label: 'ucs-catalog',
            taskName: 'Task.Ucs.Catalog',
            waitOn: {
                'when-catalog-ucs': 'succeeded'
            }
        },
        {
            'x-description': 'Set the final graph state to success when cataloging is skipped',
            label: 'noop',
            taskName: 'Task.noop',
            waitOn: {
                'when-catalog-ucs': 'failed'
            }
        }
    ]
};
