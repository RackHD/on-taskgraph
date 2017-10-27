//Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved.

"use strict";

module.exports = {
  friendlyName: "iPDU firmware update by Sftp",
  injectableName: "Graph.FirmwareUpdateIPDU",
  tasks: [
     {
            label: 'sftp-upload-firmware',
            taskDefinition: {
                injectableName: "Task.SftpFile",
                friendlyName: "sftp upload firmware of iPDU",
                implementsTask: "Task.Base.Sftp",
                options: {
                    isPDU: "true",
                    fileSource: null,
                    fileDestination: null
                },
                properties: {}
            }
    }
  ]
};
