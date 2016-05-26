// Copyright 2015, EMC, Inc.

'use strict';

module.exports = {
    "friendlyName": "Flash Quanta BIOS",
    "injectableName": "Graph.Flash.Quanta.BIOS",
    "options": {
        "defaults": {
            "downloadDir": "/opt/downloads"
        },
        "download-bios-firmware": {
            "file": null
        },
        "flash-bios": {
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
            "label": "download-bios-firmware",
            "taskName": "Task.Linux.DownloadFiles",
            "waitOn": {
                "bootstrap-ubuntu": "succeeded"
            }
        },
        {
            "label": "download-bios-tool",
            "taskName": "Task.Linux.DownloadAmiTools",
            "waitOn": {
                "download-bios-firmware": "succeeded"
            }
        },
        {
            "label": "catalog-quanta-bios-before",
            "taskName": "Task.Catalog.ami",
            "waitOn": {
                "download-bios-tool": "succeeded"
            }
        },
        {
            "label": "provide-quanta-bios-version",
            "taskName": "Task.Catalogs.Provide.Ami.BiosVersion",
            "waitOn": {
                "catalog-quanta-bios-before": "succeeded"
            }
        },
        {
            "label": "flash-bios",
            "taskName": "Task.Linux.Flash.Ami.Bios",
            "waitOn": {
                "provide-quanta-bios-version": "succeeded"
            }
        },
        {
            "label": "catalog-quanta-bios-after",
            "taskName": "Task.Catalog.ami",
            "waitOn": {
                "flash-bios": "succeeded"
            }
        },
        {
            "label": "final-reboot",
            "taskName": "Task.Obm.Node.Reboot",
            "waitOn": {
                "catalog-quanta-bios-after": "finished"
            }
        }
    ]
};
