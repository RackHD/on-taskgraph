// Copyright 2017, Dell EMC, Inc.

'use strict';

module.exports = {
    "friendlyName": "Dell perccli Catalog",
    "injectableName": "Graph.Dell.perccli.Catalog",
    "options": {
        "bootstrap-rancher": {
            dockerFile: 'secure.erase.docker.tar.xz'
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
            "label": "bootstrap-rancher",
            "taskName": "Task.Linux.Bootstrap.Rancher",
            "waitOn": {
                "reboot-start": "succeeded"
            }
        },
        {
            "ignoreFailure": true,
            "label": "catalog-perccli",
            "taskName": "Task.Catalog.perccli",
            "waitOn": {
                "bootstrap-rancher": "succeeded"
            }
        },
        {
            "label": "shell-reboot",
            "taskName": "Task.ProcShellReboot",
            "waitOn": {
                "catalog-perccli": "finished"
            }
        }
    ]
};
