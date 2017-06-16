// Copyright 2017, EMC, Inc.

"use strict";

module.exports = {
  friendlyName: "Set Idrac Ipaddress",
  injectableName: "Graph.SetIdracIp",
  options: {
       "ssh-to-microkernel":{
            commands: []
       }
  },
  tasks: [
    {
      label: "ssh-to-microkernel",
      taskName: "Task.Ssh.Exec"
    }
  ]
};
