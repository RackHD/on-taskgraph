// Copyright 2015, EMC, Inc.

'use strict';

module.exports = {
    friendlyName: 'Write Quanta BIOS NVRAM',
    injectableName: 'Graph.Write.Quanta.BIOS.NVRAM',
    options: {
        defaults: {
            file: null
        }
    },
    tasks: [
        // Bootstrap
        {
            label: 'set-boot-pxe',
            taskName: 'Task.Obm.Node.PxeBoot'
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
        // Download BIOS Config settings
        {
            label: 'download-nvram-settings',
            taskName: 'Task.Linux.DownloadFiles',
            waitOn: {
                'bootstrap-ubuntu': 'succeeded'
            }
        },
        {
            "label": "download-nvram-tool",
            "taskName": "Task.Linux.DownloadAmiTools",
            "waitOn": {
                "download-nvram-settings": "succeeded"
            }
        },
        // Write BIOS config settings to nvram
        {
            label: 'nvram-settings',
            taskName :'Task.Linux.SetNvram.Ami',
            waitOn: {
                'download-nvram-tool': 'succeeded'
            }
        },
        // Finish
        {
            label: 'final-reboot',
            taskName: 'Task.Obm.Node.Reboot',
            waitOn:{
                'nvram-settings': 'finished'
            }
        }
    ]
};

