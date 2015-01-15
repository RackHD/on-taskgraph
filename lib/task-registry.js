// Copyright 2014, Renasar Technologies Inc.
/* jshint: node:true */
'use strict';

var di = require('di'),
    util = require('util'),
    assert = require('assert'),
    events = require('events');

module.exports = factory;
di.annotate(factory, new di.Provide('TaskGraph.TaskRegistry'));
di.annotate(factory,
    new di.Inject(
        'Logger'
    )
);

if (!global.__renasar) {
    global.__renasar = { tasks:{} };
}

/**
 * Injectable wrapper for dependencies
 * @param logger
 */
function factory(logger) {
    return {
        register: function(taskInformation){
            var defaultTaskInformation= {
                name: 'No name provided',
                description: 'No description provided',
                tags: []
                injectableName: 'noop'
            };

            var taskInfo = lodash
                .defaults(
                    taskInformation | {},
                    defaultTaskInformation);

            var tasks = global.__renasar.tasks;
            tasks[taskInfo.injectableName] = taskInfo;
        },
        fetchTaskCatalog: function(){
            return global.__renasar.tasks;
        }
    }
}