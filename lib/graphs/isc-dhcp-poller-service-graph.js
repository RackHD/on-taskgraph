// Copyright 2015, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'isc-dhcp leases poller',
    injectableName: 'Graph.Service.IscDhcpLeasePoller',
    serviceGraph: true,
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
