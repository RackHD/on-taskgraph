// Copyright 2016, DELL, Inc.

'use strict';

module.exports = {
    friendlyName: 'Dell Wsman Get Bios',
    injectableName: 'Graph.Dell.Wsman.GetBios',
    options: {
        defaults: {
        	target: null
        }
    },
    tasks: [
        {
            label: 'dell-wsman-get-bios',
            taskName: 'Task.Dell.Wsman.GetBios'
        }
    ]
};
