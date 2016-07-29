// Copyright 2016, EMC, Inc.

"use strict";

module.exports = {
    "friendlyName": "Cisco Switch POAP Discovery",
    "injectableName": "Graph.Switch.Discovery.Cisco.Poap",
    "tasks": [
        {
            "label": "catalog-switch",
            "taskDefinition": {
                "friendlyName": "Catalog Cisco Switch",
                "injectableName": "Task.Inline.Catalog.Switch.Cisco",
                "implementsTask": "Task.Base.Linux.Commands",
                "options": {
                    "commands": [
                        {
                            "downloadUrl": "/api/1.1/templates/cisco-catalog-version.py",
                            "catalog": { "format": "json", "source": "version" }
                        }
                    ]
                },
                "properties": {}
            }
        }
    ]
};
