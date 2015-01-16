module.exports = {
    injectableName: 'Graph.noop-example',
    tasks: [
        {
            label: 'noop-1',
            taskName: 'Task.Base.noop'
        },
        {
            label: 'noop-2',
            taskName: 'Task.Base.noop',
            waitOn: {
                'noop-1': 'finished'
            }
        },
        {
            label: 'parallel-noop-1',
            taskName: 'Task.Base.noop',
            waitOn: {
                'noop-2': 'finished'
            }
        },
        {
            label: 'parallel-noop-2',
            taskName: 'Task.Base.noop',
            waitOn: {
                'noop-2': 'finished'
            }
        },
    ],
};
