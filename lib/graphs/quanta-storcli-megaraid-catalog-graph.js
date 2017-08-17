// Copyright 2017, Dell EMC, Inc.

'use strict';

module.exports = {
    "friendlyName": "Quanta storcli Catalog",
    "injectableName": "Graph.Quanta.storcli.Catalog",
    "options": {
        "bootstrap-ubuntu": {
            overlayfsFile: 'secure.erase.overlay.cpio.gz'
        }
    },
    "tasks": [
        {
            "ignoreFailure": true,
            "label": "set-boot-pxe",
            "taskName": "Task.Obm.Node.PxeBoot"
        },
        {
            "label": "reboot-start",
            "taskName": "Task.Obm.Node.Reboot",
            "waitOn": {
                "set-boot-pxe": "finished"
            }
        },
        {
            "label": "bootstrap-ubuntu",
            "taskName": "Task.Linux.Bootstrap.Ubuntu",
            "waitOn": {
                "reboot-start": "succeeded"
            }
        },
        {
            "ignoreFailure": true,
            "label": "catalog-storcli",
            "taskName": "Task.Catalog.megaraid",
            "waitOn": {
                "bootstrap-ubuntu": "succeeded"
            }
        },
        {
            "label": "shell-reboot",
            "taskName": "Task.ProcShellReboot",
            "waitOn": {
                "catalog-storcli": "finished"
            }
        }
    ]
};
