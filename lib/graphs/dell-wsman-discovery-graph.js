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
    				userName: null,
    				password: null
    			},
    			deviceTypesToDiscover: null
    		}],
			credentials:{
				userName: null,
				password: null
			},
			inventory: false,
			deviceTypesToDiscover: null
    	}
    },
    tasks: [
        {
            label: 'dell-wsman-discovery',
            taskName: 'Task.Dell.Wsman.Discovery'
        }
    ]
};
