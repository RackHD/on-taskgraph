// Copyright 2015, EMC, Inc.

'use strict';

module.exports = {
    "friendlyName": "Flash Quanta BMC",
    "injectableName": "Graph.Flash.Quanta.Bmc",
    "options": {
        "defaults": {
            "downloadDir": "/opt/downloads"
        },
        "download-bmc-firmware": {
            "file": null
        },
        "flash-bmc": {
            "file": null
        }
    },
    "tasks": [
        {
            "label": "set-boot-pxe",
            "taskName": "Task.Obm.Node.PxeBoot",
            "ignoreFailure": true
        },
        {
            "label": "reboot",
            "taskName": "Task.Obm.Node.Reboot",
            "waitOn": {
                "set-boot-pxe": "finished"
            }
        },
        {
            "label": "bootstrap-ubuntu",
            "taskName": "Task.Linux.Bootstrap.Ubuntu",
            "waitOn": {
                "reboot": "succeeded"
            }
        },
        {
            "label": "download-bmc-firmware",
            "taskName": "Task.Linux.DownloadFiles",
            "waitOn": {
                "bootstrap-ubuntu": "succeeded"
            }
        },
        {
            "label": "download-bmc-tool",
            "taskName": "Task.Linux.DownloadAmiTools",
            "waitOn": {
                "download-bmc-firmware": "succeeded"
            }
        },
        {
            "label": "catalog-quanta-bmc-before",
            "taskName": "Task.Catalog.bmc",
            "waitOn": {
                "download-bmc-tool": "succeeded"
            }
        },
        {
            "label": "flash-bmc",
            "taskName": "Task.Linux.Flash.Quanta.Bmc",
            "waitOn": {
                "catalog-quanta-bmc-before": "succeeded"
            }
        },
        {
            "label": "catalog-quanta-bmc-after",
            "taskName": "Task.Catalog.bmc",
            "waitOn": {
                "flash-bmc": "succeeded"
            }
        },
        {
            "label": "final-reboot",
            "taskName": "Task.Obm.Node.Reboot",
            "waitOn": {
                "catalog-quanta-bmc-after": "finished"
            }
        }
    ]
};
