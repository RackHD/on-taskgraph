'use strict';

module.exports = {
    friendlyName: 'Update Switch Firmware',
    injectableName: 'Graph.Update.Switch.Firmware',
    options: {
        'Post-update-switch-firmware': {
            ipaddress: null,
            username: null,
            password: null,
            filename: null
        }
    },
    tasks: [
        {
            label: 'On-network-login',
            taskDefinition: {
                friendlyName: 'Login on-network',
                injectableName: 'Task.Post.Login.On-network',
                implementsTask: 'Task.Base.Rest',
                options: {
                    url: "http://{{ server.onNetwork.url }}/login",
                    method: "POST",
                    headers: { "Content-Type":"application/json"},
                    recvTimeoutMs: 360000,
                    data:{
                        "username": "{{ server.onNetwork.username }}",
                        "password": "{{ server.onNetwork.password }}"
                    }
                },
                properties: {}
            }
        },
        {
            label: 'Post-update-switch-firmware',
            taskDefinition: {
                friendlyName: 'Post Update Switch Firmware',
                injectableName: 'Task.Post.Update.Switch',
                implementsTask: 'Task.Base.Rest',
                options: {
                    url: "http://{{ server.onNetwork.url }}/updateSwitch",
                    method: "POST",
                    headers: {"Authorization":"Bearer {{ context.restData.body.token }}", "Content-Type":"application/json"},
                    recvTimeoutMs: 360000,
                    data:{
                        "ip":"{{options.ipaddress}}",
                        "username":'{{options.username}}',
                        "password":'{{options.password}}',
                        "imageURL":'{{options.filename}}',
                        "switchType":"cisco",
                        "switchModel": "Nexus3000 C3164PQ Chassis"
                    }
                },
              properties: {}
            },
            waitOn: {
                "On-network-login": "succeeded"
            }
        }

    ]
};