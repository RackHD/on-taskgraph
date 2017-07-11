// Copyright 2017, DELL, Inc.

'use strict';

module.exports = {
    friendlyName: 'Redfish Ip Range Discovery',
    injectableName: 'Graph.Redfish.Ip.Range.Discovery',
    options: {
        defaults: {
            ranges:[{
                startIp: null,
                endIp: null,
                credentials:{
                    userName: null,
                    password: null
                }
            }]
        }
    },
    tasks: [
        {
            label: 'redfish-ip-range-discovery',
            taskName: 'Task.Redfish.Ip.Range.Discovery',

        },
        {
            label: 'redfish-discovery-list',
            taskName: 'Task.Redfish.Discovery.List',
            waitOn: {
                'redfish-ip-range-discovery': 'succeeded'
            }
        },
        {
            label: 'redfish-catalog-discovered',
            taskName: 'Task.General.Redfish.Catalog',
            waitOn: {
                'redfish-discovery-list': 'succeeded'
            }
        }
    ]
};