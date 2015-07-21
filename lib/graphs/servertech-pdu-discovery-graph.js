module.exports = {
    friendlyName: 'Sentry PDU Discovery',
    injectableName: 'Graph.Sentry.PDU.Discovery',
    options: {
        'collect-pdu-info': {
            mibs: [
                "Sentry3-MIB::*****"
            ]
        },
        'poller-pdu-info': {
            [ 
                {
                    "type": "snmp",
                    "pollInterval": 10000,
                    "config": {
                        "extensionMibs": [
                            "Sentry3-MIB::*****"
                        ]
                    }
                }
            ],
        }

    },
    tasks: [
        {
            label: 'ping-pdu',
            taskName: 'Task.Snmp.Ping',
        },
        {
            label: 'collect-pdu-info',
            taskName: 'Task.Snmp.Collect',
            waitOn: {
                'ping-pdu': 'succeeded'
            }
        },
        {
            label: 'catalog-pdu-info',
            taskName: 'Task.Snmp.Catalog',
            waitOn: {
                'catalog-pdu-info': 'succeeded'
            }
        },
        {
            label: 'poller-pdu-info',
            taskName: 'Task.Pollers.CreateDefault',
        }
    ]
};
