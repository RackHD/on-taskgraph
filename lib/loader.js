// Copyright 2014, Renasar Technologies Inc.
/* jshint: node:true */
'use strict';

var di = require('di'),
    dihelper = require('renasar-core')(di).helper,
    tasks = require('renasar-tasks');

module.exports = factory;
di.annotate(factory, new di.Provide('TaskGraph.DataLoader'));
di.annotate(factory, new di.Inject(
        'TaskGraph.TaskGraph',
        'Task.Task',
        'TaskGraph.Registry',
        'Logger',
        'Assert',
        'Q',
        '_',
        di.Injector
    )
);
function factory(TaskGraph, Task, registry, Logger, assert, Q, _) {
    var logger = Logger.initialize(factory);
    function loadTasks(data, factory) {
        _.forEach(data, function(definition) {
            assert.object(definition);
            assert.string(definition.injectableName);
            var _task = factory(definition);
            registry.registerTask(_task);
        });
    }

    function loadGraphs(data, factory) {
        _.forEach(data, function(definition) {
            assert.object(definition);
            assert.string(definition.injectableName);
            assert.arrayOfObject(definition.tasks);
            var _graph = factory(definition);
            registry.registerGraph(_graph);
        });
    }

    function start() {
        return Q.resolve().then(function() {
            var graphModules = dihelper.requireGlob(__dirname + '/graphs/**/*-graph.js');
            loadTasks(tasks.taskData, Task.createRegistryObject);
            loadGraphs(graphModules, TaskGraph.createRegistryObject);
            logger.info("Loaded task/graph definitions: ", {
                tasks: _.map(registry.fetchTaskCatalog(), function(t) {
                        return t.injectableName;
                    }),
                graphs: _.map(registry.fetchGraphCatalog(), function(g) {
                    return g.injectableName;
                    })
            });
        });
    }

    return {
        start: start,
        loadTasks: loadTasks,
        loadGraphs: loadGraphs
    };
}
