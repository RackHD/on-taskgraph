module.exports = {
    friendlyName: 'SKU Discovery',
    injectableName: 'Graph.SKU.Discovery',
    options: {
        defaults: {
            graphOptions: {
                target: null
            },
            nodeId: null
        }
    },
    tasks: [
        {
            label: 'discovery-graph',
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
        },
        {
            label: 'generate-sku',
            waitOn: {
                'discovery-graph': 'succeeded'
            },
            taskName: 'Task.Catalog.GenerateSku'
        },
        {
            label: 'run-sku-graph',
            taskDefinition: {
                friendlyName: 'Run SKU-specific graph',
                injectableName: 'Task.Graph.Run.SkuSpecific',
                implementsTask: 'Task.Base.Graph.RunSku',
                options: {testoptions: 'testoptions'},
                properties: {}
            },
            waitOn: {
                'generate-sku': 'succeeded'
            }

        }
    ]
};
