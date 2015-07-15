module.exports = {
    friendlyName: 'Switch Discovery',
    injectableName: 'Graph.Switch.Discovery',
    options: {},
    tasks: [
        {
            label: 'ping-host',
            taskName: 'Task.Snmp.Ping'
        },
        {
            label: 'collect-snmp',
            taskName: 'Task.Snmp.Collect',
            waitOn: {
                'ping-host' : 'succeeded'
            }
        },
        {
            label: 'catalog-snmp',
            taskName: 'Task.Snmp.Catalog',
            waitOn: {
                'collect-snmp': 'succeeded'
            }
        }
    ]
};
