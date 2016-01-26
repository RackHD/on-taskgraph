// Copyright 2015, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'Refresh node',
    injectableName: 'Graph.Refresh.Discovery',
    "options": {
        "discovery-refresh-graph": {
            "graphOptions": {
                "target": null
            }
        },
        "reboot-at-start": {
            "nodeId": null
        }
    },
    tasks: [
        {
            label: 'reboot-at-start',
            taskName: 'Task.Obm.Node.Reboot'
        },
        {
            label: 'discovery-refresh-graph',
            taskDefinition: {
                friendlyName: 'Run Discovery Graph',
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
            }
        }
    ]
};
