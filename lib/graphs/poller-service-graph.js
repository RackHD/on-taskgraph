module.exports = {
    friendlyName: 'Poller Service',
    injectableName: 'Graph.Service.Poller',
    serviceGraph: true,
    tasks: [
        {
            label: 'test-poller-queue',
            taskDefinition: {
                friendlyName: 'Test poller queue',
                injectableName: 'Task.Test.Poller',
                implementsTask: 'Task.Base.Test.Poller',
                options: {},
                properties: {}
            }
        },
        {
            label: 'ipmi',
            taskDefinition: {
                friendlyName: 'Ipmi requester',
                injectableName: 'Task.Ipmi',
                implementsTask: 'Task.Base.Ipmi',
                options: {},
                properties: {}
            }
        },
        {
            label: 'snmp',
            taskDefinition: {
                friendlyName: 'SNMP requester',
                injectableName: 'Task.Snmp',
                implementsTask: 'Task.Base.Snmp',
                options: {},
                properties: {}
            }
        },
        {
            label: 'ipmi-sdr-alert',
            taskDefinition: {
                friendlyName: 'IPMI Sdr alerter',
                injectableName: 'Task.Poller.Alert.Ipmi.Sdr',
                implementsTask: 'Task.Base.Poller.Alert.Ipmi.Sdr',
                options: {},
                properties: {}
            }
        },
        {
            label: 'snmp-alert',
            taskDefinition: {
                friendlyName: 'SNMP alerter',
                injectableName: 'Task.Poller.Alert.Snmp',
                implementsTask: 'Task.Base.Poller.Alert.Snmp',
                options: {},
                properties: {}
            }
        },
        {
            label: 'poller-cache',
            taskDefinition: {
                friendlyName: 'Poller cache',
                injectableName: 'Task.Poller.Cache',
                implementsTask: 'Task.Base.Message.Cache',
                options: {},
                properties: {}
            }
        }
    ]
};
