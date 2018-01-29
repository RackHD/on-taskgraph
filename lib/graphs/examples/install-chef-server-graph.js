//Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved.

'use strict';

module.exports = {
    friendlyName: 'Install Chef Server',
    injectableName: 'Graph.Chef.Install.Server',
    tasks: [
        {
            label: 'sftp-file',
            taskDefinition: {
                injectableName: "Task.SftpFile",
                friendlyName: "Sftp chef core",
                implementsTask: "Task.Base.Sftp",
                options: {
                    fileSource: null,
                    fileDestination: null
                },
                properties: {}
            }
        },
        {
            label: 'install-chef-core',
            taskDefinition: {
                friendlyName: "Install Chef",
                injectableName: "Task.Chef.InstallCore",
                implementsTask: "Task.Base.Ssh.Command",
                options: {
                    domainName: null,
                    chefDest: null,
                    sshExecOptions: null,
                    installCommand: "sudo dpkg -i",
                    commands: [
                        "{{options.installCommand}} {{options.chefDest}}",
                        "echo '127.0.1.1     {{options.domainName}}'"+
                        " | sudo tee -a /etc/hosts"
                    ]
                },
                "properties": {}
            },
            waitOn: {
                "sftp-file": "succeeded"
            }
        },
        {
            label: "reconfigure",
            taskDefinition: {
                injectableName: "Task.Run.Client",
                friendlyName: "Ssh and run Chef client",
                implementsTask: 'Task.Base.Ssh.Command',
                options: {
                    commands: "sudo chef-server-ctl reconfigure"
                },
                properties: {}
            },
            waitOn: {
                "install-chef-core": "succeeded"
            }
        },
        {
            label: "add-user",
            taskDefinition: {
                injectableName: "Task.Chef.User.Add",
                friendlyName: "add user",
                implementsTask: 'Task.Base.Ssh.Command',
                options: {
                    username: null,
                    firstName: null,
                    lastName: null,
                    email: null,
                    password: null,
                    userPemFile: null,
                    commands: [
                        "chef-server-ctl user-create "+
                        "{{options.username}} {{options.firstName}} {{options.lastName}} "+
                        "{{options.email}} {{options.password}}{{#options.userPemFile}}"+
                        " -f {{options.userPemFile}}{{/options.userPemFile}}"
                    ]
                },
                properties: {}
            },
            waitOn: {
                "reconfigure": "succeeded"
            }
        },
        {
            label: "add-org",
            taskDefinition: {
                injectableName: "Task.Run.Client",
                friendlyName: "add user",
                implementsTask: 'Task.Base.Ssh.Command',
                options: {
                    sshExecOptions: null,
                    shortName: null,
                    fullName: null,
                    username: null,
                    validatorPemFile: null,
                    commands: [
                        "chef-server-ctl org-create "+
                        "{{options.shortName}} '{{options.fullName}}'"+
                        "{{#options.username}} -a {{options.username}}{{/options.username}}"+
                        "{{#options.validatorPemFile}} -f {{options.validatorPemFile}}"+
                        "{{/options.validatorPemFile}}"
                    ]
                },
                properties: {}
            },
            waitOn: {
                "add-user": "succeeded"
            }
        },
    ]
};
