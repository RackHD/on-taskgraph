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

    function Loader() {
        this.graphData = dihelper.requireGlob(__dirname + '/graphs/**/*-graph.js');
        this.taskData = tasks.taskData;
    }

    Loader.prototype.loadTasks = function loadTasks(data, factory) {
        return Q.all(_.map(data, function(definition) {
            assert.object(definition);
            assert.string(definition.injectableName);
            var taskRegistryObject = factory(definition);
            return registry.registerTask(taskRegistryObject);
        }));
    };

    Loader.prototype.loadGraphs = function loadGraphs(data, factory) {
        return Q.all(_.map(data, function(definition) {
            assert.object(definition);
            assert.string(definition.injectableName);
            assert.arrayOfObject(definition.tasks);
            var graphRegistryObject = factory(definition);
            return registry.registerGraph(graphRegistryObject);
        }));
    };

    Loader.prototype.definitionsArrayToHash = function definitionsArrayToHash(data) {
        return _.transform(data, function(result, definition) {
            result[definition.injectableName] = definition;
        }, {});
    };

    Loader.prototype.mergeDefinitionArrays = function mergeDefinitionArrays(overlay, base) {
        overlay = this.definitionsArrayToHash(overlay);
        base = this.definitionsArrayToHash(base);
        var overlayKeys = _.keys(overlay);
        var baseKeys = _.keys(base);
        var allKeys = overlayKeys.concat(baseKeys);
        allKeys = _.uniq(allKeys);

        var merged = _.transform(allKeys, function(result, k) {
            if (_.has(overlay, k)) {
                result[k] = overlay[k];
            } else if (_.has(base, k)) {
                result[k] = base[k];
            }
        }, {});

        return _.map(merged, function(v) {
            return v;
        });
    };

    Loader.prototype.start = function start() {
        var self = this;

        return Q.all([
            registry.fetchTaskDefinitionCatalog(),
            registry.fetchGraphDefinitionCatalog()
        ])
        .spread(function(taskCatalog, graphCatalog) {
            var graphResults = self.mergeDefinitionArrays(self.graphData, graphCatalog);
            var taskResults = self.mergeDefinitionArrays(self.taskData, taskCatalog);

            return [
                self.loadTasks(taskResults, Task.createRegistryObject),
                self.loadGraphs(graphResults, TaskGraph.createRegistryObject)
            ];
        })
        .spread(function(taskResults, graphResults) {
            logger.info("Loaded " + taskResults.length + " tasks");
            logger.info("Loaded " + graphResults.length + " graphs");
        })
        .then(function() {
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
    };

    return new Loader();
}
