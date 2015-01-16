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
        'Logger',
        'Assert',
        'Q',
        '_',
        di.Injector
    )
);
function factory(TaskGraph, Task, Logger, assert, Q, _, injector) {
    var logger = Logger.initialize(factory);
    function load(data, factory) {
        return _.map(data, function(definition) {
            assert.object(definition);
            assert.string(definition.injectableName);
            // TODO: make this less convoluted
            var _task = factory(definition);
            di.annotate(_task, new di.Provide(definition.injectableName));
            return _task;
        });
    }

    function start() {
        return Q.resolve().then(function() {
            return [load(tasks.taskData, Task.createFactory), tasks.taskData];
        }).spread(function(taskObjects, taskModules) {
            var graphModules = dihelper.requireGlob(process.cwd() + '/lib/graphs/**/*-graph.js');
            var graphObjects = load(graphModules, TaskGraph.createFactory);
            return [taskObjects, taskModules, graphObjects, graphModules];
        }).spread(function(taskObjects, taskModules, graphObjects, graphModules) {
            // update the global injector with all the new task/graph objects
            injector = injector.createChild(
                _.flatten([
                    taskObjects,
                    graphObjects
                ])
            );
            logger.info("Loaded tasks: ", {
                tasks: _.map(taskModules, function(t) { return t.injectableName; })
            });
            logger.info("Loaded graphs: ", {
                graphs: _.map(graphModules, function(g) { return g.injectableName; })
            });
        });
    }

    return {
        start: start,
        load: load
    };
}
