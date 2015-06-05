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
