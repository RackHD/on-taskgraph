// Copyright 2016, DELL, Inc.

'use strict';

module.exports = {
    friendlyName: 'Dell Wsman PostDiscovery',
    injectableName: 'Graph.Dell.Wsman.PostDiscovery',
    options: {
    	defaults: {
    		data: null,
			credentials:{
				user: null,
				password: null
			}
    	}
    },
    tasks: [
        {
            label: 'dell-wsman-get-inventory',
            taskName: 'Task.Dell.Wsman.GetInventory',
            ignoreFailure: true
        },
        {
            label: 'dell-wsman-get-bios',
            taskName: 'Task.Dell.Wsman.GetBios',
            waitOn: {
                'dell-wsman-get-inventory': 'finished'
            },
            ignoreFailure: true
        },
        {
             label: 'create-redfish-pollers',
             taskDefinition: {
                  friendlyName: 'Create Default Pollers',
                  injectableName: 'Task.Inline.Pollers.Redfish.CreateDefault',
                  implementsTask: 'Task.Base.Pollers.Redfish.CreateDefault',
                  properties: {},
                  options: {
                      pollers: [
                          {
                              "type": "redfish",
                              "pollInterval": 20000,
                              "config": {
                                  "command": "managers.logservices"
                              }
                          }
                      ]
                  }
             },
             waitOn: {
              'dell-wsman-get-bios': 'succeeded'
             }
        }
    ]
};
