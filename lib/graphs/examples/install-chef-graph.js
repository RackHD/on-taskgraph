//Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved.

'use strict';

module.exports = {
    friendlyName: 'Install Chef Client',
    injectableName: 'Graph.Chef.Install',
    tasks: [
        {
            label: 'sftp-archive',
            taskDefinition: {
                injectableName: "Task.SftpKey",
                friendlyName: "Sftp chef keys",
                implementsTask: "Task.Base.Sftp",
                options: {
                    archiveSrc: null,
                    archiveName: null,
                    fileSource: "{{options.archiveSrc}}",
                    fileDestination: "/etc/{{options.archiveName}}"
                },
                properties: {}
            }
        },
        {
            label: 'get-chef-client',
            taskDefinition: {
                friendlyName: "Task.Get.Chef.Installer",
                injectableName: "Task.Chef.GetInstaller",
                implementsTask: "Task.Base.Ssh.Command",
                options: {
                    chefIP: null,
                    domainName: null,
                    archiveName: null,
                    commands: [
                    "curl -L https://omnitruck.chef.io/install.sh | sudo bash;",
                    "{{#options.chefIP}}{{#options.domainName}}" +
                    "echo '{{options.chefIP}}     {{options.domainName}}'"+
                    " | sudo tee -a /etc/hosts"+
                    "{{/options.domainName}}{{/options.chefIP}}",
                    "tar -xvf /etc/{{options.archiveName}} -C /etc"
                    ]
                },
                "properties": {}
            },
            waitOn: {
                "sftp-archive": "succeeded"
            }
        },
        {
            label: "run-client",
            taskDefinition: {
                injectableName: "Task.Run.Client",
                friendlyName: "Ssh and run Chef client",
                implementsTask: 'Task.Base.Ssh.Command',
                options: {
                    name: null,
                    commands: "sudo /usr/bin/chef-client -N {{options.name || task.nodeId}}"
                },
                properties: {}
            },
            waitOn: {
                "get-chef-client": "succeeded"
            }
        }
    ]
};
