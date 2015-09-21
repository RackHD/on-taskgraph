// Copyright 2015, EMC, Inc.

module.exports = {
    friendlyName: 'Cold Reset BMC',
    injectableName: 'Graph.McReset',
    tasks: [
        {
            label: 'mc-reset',
            taskName: 'Task.Obm.Node.McResetCold'
        }
    ]
};
