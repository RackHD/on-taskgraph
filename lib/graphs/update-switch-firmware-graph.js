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
            label: 'Post-update-switch-firmware',
            taskDefinition: {
                friendlyName: 'Post Update Switch Firmware',
                injectableName: 'Task.Post.Update.Switch',
                implementsTask: 'Task.Base.Rest',
                options: {
                    url: "http://10.246.61.95:8081/updateSwitch",
                    method: "POST",
                    headers: {"Authorization":"whatever", "Content-Type":"application/json"},
                    recvTimeoutMs: 360000,
                    data:{
                        "endpoint": {
                            "ip": "{{options.ipaddress}}",
                            "username": '{{options.username}}',
                            "password": '{{options.password}}',
                            "switchType": "cisco"
                        },

                        "imageURL":'{{options.filename}}',
                        "switchModel": "Nexus3000 C3164PQ Chassis"
                    }
                },
              properties: {}

            }
        }
    ]
};