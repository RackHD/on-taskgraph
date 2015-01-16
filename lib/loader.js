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
        'Logger',
        'Assert',
        'Q',
        '_',
        di.Injector
    )
);
function factory(TaskGraph, Logger, assert, Q, _, injector) {
    var logger = Logger.initialize(factory);
    function start() {
        return Q.resolve().then(function() {
            var taskObjects = [];
            var taskModules = tasks.taskData;
            _.forEach(taskModules, function(taskDefinition) {
                assert.object(taskDefinition);
                assert.string(taskDefinition.injectableName);
                // TODO: make this less convoluted
                var _task = TaskGraph.createFactory(taskDefinition);
                di.annotate(_task, new di.Provide(taskDefinition.injectableName));
                taskObjects.push(_task);
            });
            return [taskObjects, taskModules];
        }).spread(function(taskObjects, taskModules) {
            var graphObjects = [];
            var graphModules = dihelper.requireGlob(process.cwd() + '/lib/graphs/**/*-graph.js');
            _.forEach(graphModules, function(graphDefinition) {
                assert.object(graphDefinition);
                assert.string(graphDefinition.injectableName);
                // TODO: make this less convoluted
                var _graph = TaskGraph.createFactory(graphDefinition);
                di.annotate(_graph, new di.Provide(graphDefinition.injectableName));
                graphObjects.push(_graph);
            });
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
        start: start
    };
}
