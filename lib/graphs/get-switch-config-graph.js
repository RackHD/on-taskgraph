// Copyright 2017, Dell EMC, Inc.
'use strict';

module.exports = {
    friendlyName: 'Get Switch Config Graph',
    injectableName: 'Graph.Get.Switch.Config',
    options: {
        'Get-switch-config': {
            ipaddress: null,
            username: null,
            password: null
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
            label: 'Get-switch-config',
            taskDefinition: {
                friendlyName: 'Get Switch Config',
                injectableName: 'Task.Get.Switch.Config',
                implementsTask: 'Task.Base.Rest.Catalog',
                options: {
                    url: "http://{{ server.onNetwork.url }}/switchConfig",
                    method: "POST",
                    headers: {"Authorization":"Bearer {{ context.restData.body.token }}", "Content-Type":"application/json"},
                    recvTimeoutMs: 360000,
                    data:{
                        "endpoint": {
                          "ip":"{{options.ipaddress}}",
                          "username":'{{options.username}}',
                          "password":'{{options.password}}',
                          "switchType":"cisco"
                        }
                    },
                    source: 'running-config'
                },
              properties: {
                catalog: {
                  type: 'running-config'
                }
              }

            },
            waitOn: {
                "On-network-login": "succeeded"
            }
        }
    ]
};
