module.exports = {
    friendlyName: 'Switch Discovery',
    injectableName: 'Graph.Switch.Discovery',
    options: {
        'create-switch-snmp-pollers': {
            pollers: [
                {
                    "type": "snmp",
                    "pollInterval": 60000,
                    "config": {
                        "metric": "snmp-interface-bandwidth-utilization"
                    }
                },
                {
                    "type": "snmp",
                    "pollInterval": 60000,
                     "config": {
                        "metric": "snmp-interface-state"
                    }
                }
            ]
        }
    },
    tasks: [
        {
            label: 'ping-host',
            taskName: 'Task.Snmp.Ping'
        },
        {
            label: 'collect-snmp',
            taskName: 'Task.Snmp.Collect.Discovery',
            waitOn: {
                'ping-host' : 'succeeded'
            }
        },
        {
            label: 'catalog-snmp',
            taskName: 'Task.Snmp.Catalog',
            waitOn: {
                'ping-host': 'succeeded'
            }
        },
        {
            label: 'create-switch-snmp-pollers',
            taskName: 'Task.Pollers.CreateDefault',
            waitOn: {
                'catalog-snmp': 'succeeded'
            }
        }
    ]
};
