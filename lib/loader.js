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
        return Q.all(_.map(data, function(definition) {
            assert.object(definition);
            assert.string(definition.injectableName);
            var taskRegistryObject = factory(definition);
            return registry.registerTask(taskRegistryObject);
        }));
    }

    function loadGraphs(data, factory) {
        return Q.all(_.map(data, function(definition) {
            assert.object(definition);
            assert.string(definition.injectableName);
            assert.arrayOfObject(definition.tasks);
            var graphRegistryObject = factory(definition);
            return registry.registerGraph(graphRegistryObject);
        }));
    }

    function start() {
        var graphModules = dihelper.requireGlob(__dirname + '/graphs/**/*-graph.js');
        return loadTasks(tasks.taskData, Task.createRegistryObject)
        .then(function(results) {
            logger.info("Loaded " + results.length + " tasks");
            return loadGraphs(graphModules, TaskGraph.createRegistryObject);
        })
        .then(function(results) {
            logger.info("Loaded " + results.length + " graphs");
            return [registry.fetchTaskDefinitionCatalog(), registry.fetchGraphDefinitionCatalog()];
        })
        .spread(function(taskCatalog, graphCatalog) {
            logger.info("Loaded task/graph definitions: ", {
                tasks: _.map(taskCatalog, function(t) {
                        return t.injectableName;
                    }),
                graphs: _.map(graphCatalog, function(g) {
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
