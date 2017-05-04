//Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved.

'use strict';

module.exports = {
    friendlyName: 'ESXi Driver Version Retrieval',
    injectableName: 'Graph.Driver.Version.Retrieval',
    options: {
        defaults: {
            commands: null
            }
    },
    tasks: [
        {
            label: 'versionRetrieval',
            taskDefinition: {
                injectableName: "Task.Run.Ssh",
                friendlyName: "Ssh and run Esxi commands",
                implementsTask: 'Task.Base.Ssh',
                options: {
                    commands: null
                },
                properties: {}
            }
        }
    ]
};
