// Copyright 2015, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'isc-dhcp leases poller',
    injectableName: 'Graph.Service.IscDhcpLeasePoller',
    serviceGraph: false,
    options: {
        'isc-dhcp-lease-poller': {
            schedulerOverrides: {
                timeout: -1
            }
        }
    },
    tasks: [
        {
            label: 'isc-dhcp-lease-poller',
            taskName: 'Task.IscDhcpLeasePoller'
        }
    ]
};
