// Copyright 2014, Renasar Technologies Inc.
/* jshint: node:true */
'use strict';

var di = require('di');

module.exports = factory;
di.annotate(factory, new di.Provide('TaskGraph.Registry'));
di.annotate(factory,
    new di.Inject(
        'Q',
        '_',
        di.Injector
    )
);

if (!global.__renasar) {
    global.__renasar = { tasks: {}, graphs: {} };
}

/**
 * Injectable wrapper for dependencies
 * @param logger
 */
function factory(Q, _, injector) {
    var funcs = {
        registerTask: function(taskInformation) {
            var defaultTaskInformation = {
                name: 'No name provided',
                description: 'No description provided',
                tags: [],
                injectableName: 'noop'
            };
            var taskInfo = _.defaults(taskInformation || {}, defaultTaskInformation);

            var tasks = global.__renasar.tasks;
            tasks[taskInfo.injectableName] = taskInfo;
        },
        registerGraph: function(graphInformation) {
            var defaultGraphInformation = {
                name: 'No name provided',
                description: 'No description provided',
                tags: [],
                injectableName: 'noop'
            };
            var graphInfo = _.defaults(graphInformation || {}, defaultGraphInformation);

            var graphs = global.__renasar.graphs;
            graphs[graphInfo.injectableName] = graphInfo;
        },
        fetchTaskCatalog: function(){
            return global.__renasar.tasks;
        },
        start: function() {
            // Wrap in a then block so we can promise.catch()
            return Q.resolve().then(function() {
                _.forEach(injector.getMatching('Task.*'), function(task) {
                    funcs.registerTask(task);
                });
                _.forEach(injector.getMatching('Graph.*'), function(graph) {
                    funcs.registerGraph(graph);
                });
            });
        },
        stop: function() {
            global.__renasar = { tasks: {}, graphs: {} };
            return Q.resolve();
        }
    };

    return funcs;
}
