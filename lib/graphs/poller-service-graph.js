module.exports = {
    friendlyName: 'Poller Service',
    injectableName: 'Graph.Service.Poller',
    options: {
        'test-poller-queue': {
            ipmiSdrRoutingKey: '<%=uuid%>',
            snmpRoutingKey: '<%=uuid%>'
        },
        'ipmi-sdr': {
            ipmiSdrRoutingKey: '<%=uuid%>'
        },
        'ipmi-sdr-alert': {
            ipmiSdrRoutingKey: '<%=uuid%>'
        },
        'snmp': {
            snmpRoutingKey: '<%=uuid%>'
        },
        'snmp-alert': {
            snmpRoutingKey: '<%=uuid%>'
        }
    },
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
            label: 'ipmi-sdr',
            taskName: 'Task.Ipmi.Sdr',
            waitOn: {
                'ipmi-sdr-alert': 'started'
            }
        },
        {
            label: 'snmp',
            taskName: 'Task.Snmp',
            waitOn: {
                'snmp-alert': 'started'
            }
        },
        {
            label: 'ipmi-sdr-alert',
            taskName: 'Task.Poller.Alert.Ipmi.Sdr'
        },
        {
            label: 'snmp-alert',
            taskName: 'Task.Poller.Alert.Snmp'
        }
    ]
};
