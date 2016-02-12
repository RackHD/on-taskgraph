// Copyright 2016, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'Refresh node',
    injectableName: 'Graph.Refresh.Discovery',
    options: {
        'reboot-at-start': {
            nodeId: null
        },
        'discovery-refresh-graph': {
            graphOptions: {
                target: null
            },
        },
        'generate-sku': {
            nodeId: null
        },
        'generate-enclosure': {
            nodeId: null
        },
        'create-default-pollers': {
            nodeId: null
        },
        'run-sku-graph': {
            nodeId: null
        },
    },
    tasks: [
        {
            label: 'reboot-at-start',
            taskName: 'Task.Obm.Node.Reboot'
        },
        {
            label: 'discovery-refresh-graph',
            taskDefinition: {
                friendlyName: 'Run Discovery Refresh Graph',
                injectableName: 'Task.Graph.Run.Discovery',
                implementsTask: 'Task.Base.Graph.Run',
                options: {
                    graphName: 'Graph.Discovery',
                    graphOptions: {}
                },
                properties: {}
            },
            waitOn: {
                'reboot-at-start': 'succeeded'
            },
        },
        {
            label: 'generate-sku',
            waitOn: {
                'discovery-refresh-graph': 'succeeded'
            },
            taskName: 'Task.Catalog.GenerateSku',
        },
        {
            label: 'generate-enclosure',
            waitOn: {
                'discovery-refresh-graph': 'succeeded'
            },
            taskName: 'Task.Catalog.GenerateEnclosure',
            ignoreFailure: true
        },
        {
            label: 'create-default-pollers',
            taskDefinition: {
                friendlyName: 'Create Default Pollers',
                injectableName: 'Task.Inline.Pollers.CreateDefault',
                implementsTask: 'Task.Base.Pollers.CreateDefault',
                properties: {},
                options: {
                    nodeId: null,
                    pollers: [
                        {
                            "type": "ipmi",
                            "pollInterval": 60000,
                            "config": {
                                "command": "sdr"
                            }
                        },
                        {
                            "type": "ipmi",
                            "pollInterval": 60000,
                            "config": {
                                "command": "selInformation"
                            }
                        },
                        {
                            "type": "ipmi",
                            "pollInterval": 60000,
                            "config": {
                                "command": "sel"
                            }
                        },
                        {
                            "type": "ipmi",
                            "pollInterval": 15000,
                            "config": {
                                "command": "chassis"
                            }
                        },
                        {
                            "type": "ipmi",
                            "pollInterval": 30000,
                            "config": {
                                "command": "driveHealth"
                            }
                        }
                    ]
                }
            },
            waitOn: {
                'discovery-refresh-graph': 'succeeded'
            }
        },
        {
            label: 'run-sku-graph',
            taskDefinition: {
                friendlyName: 'Run SKU-specific graph',
                injectableName: 'Task.Graph.Run.SkuSpecific',
                implementsTask: 'Task.Base.Graph.RunSku',
                options: {},
                properties: {}
            },
            waitOn: {
                'generate-sku': 'succeeded'
            }

        }
    ]
};
