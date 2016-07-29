// Copyright (C) 2016 Brocade Communications Systems, Inc.

"use strict";

module.exports = {
    "friendlyName": "Brocade Switch  Discovery",
    "injectableName": "Graph.Switch.Discovery.Brocade.Ztp",
    "tasks": [
        {
            "label": "catalog-brocade-switch",
            "taskDefinition": {
                "friendlyName": "Catalog Brocade Switch",
                "injectableName": "Task.Inline.Catalog.Switch.Brocade",
                "implementsTask": "Task.Base.Linux.Commands",
                "options": {
                    "commands": [
                        {
                            "downloadUrl": "/api/1.1/templates/brocade-catalog-version.py",
                            "catalog": { "format": "json", "source": "version" }
                        }
                    ]
                },
                "properties": {}
            }
        }
    ]
};
