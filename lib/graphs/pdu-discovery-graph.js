// Copyright 2015, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'Switch Discovery',
    injectableName: 'Graph.PDU.Discovery',
    options: {
        defaults: {
            nodeId: null
        },
        'create-pdu-snmp-pollers': {
            pollers: [
                {
                    "type": "snmp",
                    "pollInterval": 60000,
                    "config": {
                        "metric": "snmp-pdu-power-status"
                    }
                },
                {
                    "type": "snmp",
                    "pollInterval": 60000,
                    "config": {
                        "metric": "snmp-pdu-sensor-status"
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
            label: 'create-pdu-snmp-pollers',
            taskName: 'Task.Pollers.CreateDefault',
            waitOn: {
                'catalog-snmp': 'succeeded'
            }
        },
        {
            label: 'update-node-name',
            taskName: 'Task.Snmp.Node.Update',
            waitOn: {
                'catalog-snmp': 'succeeded'
            }
        },
        {
            label: 'node-discovered-alert',
            taskName: 'Task.Alert.Node.Discovered',
            waitOn: {
                'update-node-name': 'finished'
            }
        }
    ]
};
