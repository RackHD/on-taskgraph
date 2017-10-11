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
            label: 'Get-switch-config',
            taskDefinition: {
                friendlyName: 'Get Switch Config',
                injectableName: 'Task.Get.Switch.Config',
                implementsTask: 'Task.Base.Rest.Catalog',
                options: {
                    url: "http://10.246.61.95:8081/switchVersion",
                    method: "POST",
                    headers: {"Authorization":"whatever", "Content-Type":"application/json"},
                    recvTimeoutMs: 360000,
                    data:{
                        "endpoint": {
                          "ip":"{{options.ipaddress}}",
                          "username":'{{options.username}}',
                          "password":'{{options.password}}',
                          "switchType":"cisco"
                        }
                    },
                    source: 'version'
                },
              properties: {
                catalog: {
                  type: 'version'
                }
              }

            }
        }
    ]
};
