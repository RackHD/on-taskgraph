// Copyright 2015, EMC, Inc.

module.exports = {
    friendlyName: 'Poller Service',
    injectableName: 'Graph.Service.Poller',
    serviceGraph: true,
    options: {
        'clean-workitems': {
            schedulerOverrides: {
                timeout: -1
            }
        },
        'run-workitems': {
            schedulerOverrides: {
                timeout: -1
            }
        },
        'ipmi': {
            schedulerOverrides: {
                timeout: -1
            }
        },
        'snmp': {
            schedulerOverrides: {
                timeout: -1
            }
        },
        'common-network-command': {
            schedulerOverrides: {
                timeout: -1
            }
        },
        'ipmi-sdr-alert': {
            schedulerOverrides: {
                timeout: -1
            }
        },
        'ipmi-sel-alert': {
            schedulerOverrides: {
                timeout: -1
            }
        },
        'snmp-alert': {
            schedulerOverrides: {
                timeout: -1
            }
        },
        'ping-alert': {
            schedulerOverrides: {
                timeout: -1
            }
        },
        'poller-cache': {
            schedulerOverrides: {
                timeout: -1
            }
        }
    },
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
            label: 'common-network-command',
            taskDefinition: {
                friendlyName: 'Common Network Command requester',
                injectableName: 'Task.Inline.Common.Network.Command',
                implementsTask: 'Task.Base.Common.Network.Command',
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
            label: 'ping-alert',
            taskDefinition: {
                friendlyName: 'Ping alerter',
                injectableName: 'Task.Inline.Poller.Alert.Ping',
                implementsTask: 'Task.Base.Poller.Alert.Ping',
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
