module.exports = {
    friendlyName: 'Switch Discovery',
    injectableName: 'Graph.Switch.Discovery',
    options: {
        'create-switch-snmp-pollers': [
            {
                "type": "snmp",
                "pollInterval": 60000,
                "config": {
                    "name": "snmp-interface-bandwidth-utilization",
                    "oids": [
                        "IF-MIB::ifSpeed",
                        "IF-MIB::ifInOctets",
                        "IF-MIB::ifOutOctets"
                    ],
                    "snmpQueryType": "bulkget"
                }
            },
            {
                "type": "snmp",
                "pollInterval": 60000,
                "config": {
                    "name": "snmp-interface-link-state",
                    "oids": [
                        "IF-MIB::ifOperStatus",
                    ]
                }
            }
        ]
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
            taskName: 'Task.Pollers.CreateDefault'
        }
    ]
};
