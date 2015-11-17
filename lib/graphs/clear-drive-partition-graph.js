// Copyright 2015, EMC, Inc.

module.exports = {
    friendlyName: 'Clear Drives Partition',
    injectableName: 'Graph.ClearDrivePartition',
    tasks: [
        {
            label: 'set-boot-pxe',
            taskName: 'Task.Obm.Node.PxeBoot',
            ignoreFailure: true
        },
        {
            label: 'reboot',
            taskName: 'Task.Obm.Node.Reboot',
            waitOn: {
                'set-boot-pxe': 'finished'
            }
        },
        {
            label: 'bootstrap-ubuntu',
            taskName: 'Task.Linux.Bootstrap.Ubuntu',
            waitOn: {
                'reboot': 'succeeded'
            }
        },
        {
            label: 'clear-drive-partition',
            taskName: 'Task.Drive.Clear.Partition',
            waitOn: {
                'bootstrap-ubuntu': 'succeeded'
            }
        }
    ]
};
