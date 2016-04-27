// Copyright 2016, EMC, Inc.

"use strict";

module.exports = {
    "friendlyName": "Deploy Arista switch startup config",
    "injectableName": "Graph.Switch.Arista.DeployStartupConfig",
    "options": {
        "deploy-startup-config": {
            "startupConfig": null,
        }
    },
    "tasks": [
        {
            "label": "deploy-startup-config",
            "taskDefinition": {
                "friendlyName": "Deploy switch startup config",
                "injectableName": "Task.Inline.Switch.Deploy.StartupConfig",
                "implementsTask": "Task.Base.Linux.Commands",
                "options": {
                    "startupConfig": null,
                    "startupConfigUri": "{{ api.base }}/templates/{{ options.startupConfig }}",
                    "commands": [
                        {
                            "downloadUrl": "/api/1.1/templates/arista-deploy-startup-config.py"
                        }
                    ]
                },
                "properties": {}
            }
        }
    ]
};
