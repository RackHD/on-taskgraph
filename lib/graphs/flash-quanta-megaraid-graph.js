module.exports = {
    "friendlyName": "Flash Quanta MegaRAID",
    "injectableName": "Graph.Flash.Quanta.MegaRAID",
    "options": {
        "defaults": {
            "downloadDir": "/opt/downloads"
        },
        "bootstrap-ubuntu": {
            "overlayfs": "common/overlayfs_quanta_t41_flash-v1.1-3.13.0-32.cpio.gz"
        },
        "download-megaraid-firmware": {
            "file": null
        },
        "flash-megaraid": {
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
            "label": "download-megaraid-firmware",
            "taskName": "Task.Linux.DownloadFiles",
            "waitOn": {
                "bootstrap-ubuntu": "succeeded"
            }
        },
        {
            "label": "catalog-quanta-megaraid-before",
            "taskName": "Task.Catalog.megaraid",
            "waitOn": {
                "download-megaraid-firmware": "succeeded"
            }
        },
        {
            "label": "flash-megaraid",
            "taskName": "Task.Linux.Flash.LSI.MegaRAID",
            "waitOn": {
                "catalog-quanta-megaraid-before": "succeeded"
            }
        },
        {
            "label": "catalog-quanta-megaraid-after",
            "taskName": "Task.Catalog.megaraid",
            "waitOn": {
                "flash-megaraid": "succeeded"
            }
        },
        {
            "label": "shell-reboot",
            "taskName": "Task.ProcShellReboot",
            "waitOn": {
                "catalog-quanta-megaraid-after": "succeeded"
            }
        }
    ]
};
