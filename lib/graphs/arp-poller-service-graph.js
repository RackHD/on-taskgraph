// Copyright 2016, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'ARP poller',
    injectableName: 'Graph.Service.ArpPoller',
    serviceGraph: true,
    options: {
        'arp-poller': {
            schedulerOverrides: {
                timeout: -1
            }
        }
    },
    tasks: [
        {
            label: 'arp-poller',
            taskName: 'Task.ArpPoller'
        }
    ]
};


