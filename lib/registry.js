// Copyright 2014, Renasar Technologies Inc.
/* jshint: node:true */
'use strict';

var di = require('di');

module.exports = factory;
di.annotate(factory, new di.Provide('TaskGraph.Registry'));
di.annotate(factory,
    new di.Inject(
        'Assert',
        '_'
    )
);

if (!global.__renasar) {
    global.__renasar = { tasks: {}, graphs: {} };
}

/**
 * Injectable wrapper for dependencies
 * @param logger
 */
function factory(assert, _) {
    return {
        registerTask: function(task) {
            assert.object(task);
            assert.object(task.definition);
            assert.string(task.definition.injectableName);
            assert.func(task.create);
            var tasks = global.__renasar.tasks;
            tasks[task.definition.injectableName] = task;
        },
        registerGraph: function(graph) {
            assert.object(graph);
            assert.object(graph.definition);
            assert.string(graph.definition.injectableName);
            assert.func(graph.create);
            var graphs = global.__renasar.graphs;
            graphs[graph.definition.injectableName] = graph;
        },
        fetchTaskCatalog: function(){
            return _.map(global.__renasar.tasks, function(task) {
                return task.definition;
            });
        },
        fetchGraphCatalog: function(){
            return _.map(global.__renasar.graphs, function(graph) {
                return graph.definition;
            });
        },
        fetchTask: function(taskName) {
            return global.__renasar.tasks[taskName];
        },
        fetchGraph: function(graphName) {
            return global.__renasar.graphs[graphName];
        }
    };
}
