// Copyright 2015, EMC, Inc.

module.exports = {
    friendlyName: 'Soft Reset Node',
    injectableName: 'Graph.Reset.Soft.Node',
    tasks: [
        {
            label: 'soft-reset',
            taskName: 'Task.Obm.Node.Reset.Soft'
        }
    ]
};
