// Copyright 2016, EMC, Inc.

"use strict";

module.exports = {
    "friendlyName": "Arista Switch ZTP Discovery",
    "injectableName": "Graph.Switch.Discovery.Arista.Ztp",
    "tasks": [
        {
            "label": "catalog-switch",
            "taskDefinition": {
                "friendlyName": "Catalog Arista Switch",
                "injectableName": "Task.Inline.Catalog.Switch.Arista",
                "implementsTask": "Task.Base.Linux.Commands",
                "options": {
		    "commands": [
                        {
                            "downloadUrl": "/api/1.1/templates/arista-catalog-version.py",
                            "catalog": { "format": "json", "source": "version" }
                        }
                    ]
                },
                "properties": {}
            }
        }
    ]
};
