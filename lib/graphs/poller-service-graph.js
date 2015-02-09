module.exports = {
    friendlyName: 'Poller Service',
    injectableName: 'Graph.Service.Poller',
    serviceGraph: true,
    tasks: [
        {
            label: 'clean-workitems',
            taskDefinition: {
                friendlyName: 'Clean Poller Work Items',
                injectableName: 'Task.Inline.Poller.WorkItems.Clean',
                implementsTask: 'Task.Base.WorkItems.Clean',
                options: {},
                properties: {}
            }
        },
        {
            label: 'run-workitems',
            taskDefinition: {
                friendlyName: 'Run Poller Work Items',
                injectableName: 'Task.Inline.Poller.WorkItems.Run',
                implementsTask: 'Task.Base.WorkItems.Run',
                options: {},
                properties: {}
            }
        },
        /*
        {
            label: 'test-poller-service',
            taskDefinition: {
                friendlyName: 'Test Poller Service',
                injectableName: 'Task.Inline.Test.Poller',
                implementsTask: 'Task.Base.Test.Poller',
                options: {},
                properties: {}
            }
        },
        */
        {
            label: 'ipmi',
            taskDefinition: {
                friendlyName: 'Ipmi requester',
                injectableName: 'Task.Inline.Ipmi',
                implementsTask: 'Task.Base.Ipmi',
                options: {},
                properties: {}
            }
        },
        {
            label: 'snmp',
            taskDefinition: {
                friendlyName: 'SNMP requester',
                injectableName: 'Task.Inline.Snmp',
                implementsTask: 'Task.Base.Snmp',
                options: {},
                properties: {}
            }
        },
        {
            label: 'ipmi-sdr-alert',
            taskDefinition: {
                friendlyName: 'IPMI Sdr alerter',
                injectableName: 'Task.Inline.Poller.Alert.Ipmi.Sdr',
                implementsTask: 'Task.Base.Poller.Alert.Ipmi.Sdr',
                options: {},
                properties: {}
            }
        },
        {
            label: 'ipmi-sel-alert',
            taskDefinition: {
                friendlyName: 'IPMI Sel alerter',
                injectableName: 'Task.Inline.Poller.Alert.Ipmi.Sel',
                implementsTask: 'Task.Base.Poller.Alert.Ipmi.Sel',
                options: {},
                properties: {}
            }
        },
        {
            label: 'snmp-alert',
            taskDefinition: {
                friendlyName: 'SNMP alerter',
                injectableName: 'Task.Inline.Poller.Alert.Snmp',
                implementsTask: 'Task.Base.Poller.Alert.Snmp',
                options: {},
                properties: {}
            }
        },
        {
            label: 'poller-cache',
            taskDefinition: {
                friendlyName: 'Poller cache',
                injectableName: 'Task.Inline.Poller.Cache',
                implementsTask: 'Task.Base.Message.Cache',
                options: {},
                properties: {}
            }
        }
    ]
};
