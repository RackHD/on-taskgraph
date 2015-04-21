module.exports = {
    friendlyName: 'isc-dhcp leases poller',
    injectableName: 'Graph.Service.IscDhcpLeasePoller',
    serviceGraph: true,
    tasks: [
        {
            label: 'isc-dhcp-lease-poller',
            taskName: 'Task.IscDhcpLeasePoller'
        }
    ]
};
