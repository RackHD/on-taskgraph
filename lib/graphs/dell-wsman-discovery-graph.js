// Copyright 2016, DELL, Inc.

'use strict';

module.exports = {
    friendlyName: 'Dell Wsman Discovery',
    injectableName: 'Graph.Dell.Wsman.Discovery',
    options: {
    	defaults: {
    		ranges:[{
    			startIp: null,
    			endIp: null,
    			credentials:{
    				user: null,
    				password: null
    			}
    		}],
			credentials:{
				user: null,
				password: null
			},
			inventory: false
    	}
    },
    tasks: [
        {
            label: 'dell-wsman-discovery',
            taskName: 'Task.Dell.Wsman.Discovery'
        }
    ]
};
