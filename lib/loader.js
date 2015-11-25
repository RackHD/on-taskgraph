// Copyright 2015, EMC, Inc.
/* jshint: node:true */

'use strict';

var di = require('di'),
    dihelper = require('on-core')(di).helper;

module.exports = factory;
di.annotate(factory, new di.Provide('TaskGraph.DataLoader'));
di.annotate(factory, new di.Inject(
        'TaskGraph.TaskGraph',
        'Task.Task',
        'Task.taskLibrary',
        'TaskGraph.Store',
        'Logger',
        'Assert',
        'Promise',
        '_',
        di.Injector
    )
);
function factory(TaskGraph, Task, taskLibrary, store, Logger, assert, Promise, _) {
    var logger = Logger.initialize(factory);

    function Loader() {
        this.graphData = dihelper.requireGlob(__dirname + '/graphs/**/*-graph.+(js|json)');
    }

    Loader.prototype.loadTasks = function loadTasks(definitions) {
        return Promise.map(definitions, function(definition) {
            assert.object(definition);
            assert.string(definition.injectableName);
            return store.persistTaskDefinition(definition);
        });
    };

    Loader.prototype.loadGraphs = function loadGraphs(definitions) {
        return Promise.map(definitions, function(definition) {
            assert.object(definition);
            assert.string(definition.injectableName);
            assert.arrayOfObject(definition.tasks);
            return store.persistGraphDefinition(definition);
        });
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

        return Promise.all([
            store.getTaskDefinitions(),
            store.getGraphDefinitions()
        ])
        .spread(function(taskCatalog, graphCatalog) {
            var graphResults = self.mergeDefinitionArrays(self.graphData, graphCatalog);
            var taskResults = self.mergeDefinitionArrays(taskLibrary, taskCatalog);
            taskResults = _.filter(taskResults, function(task) {
                return task.implementsTask;
            });

            return [
                self.loadTasks(taskResults),
                self.loadGraphs(graphResults)
            ];
        })
        .spread(function(taskResults, graphResults) {
            logger.info("Loaded " + taskResults.length + " tasks");
            logger.info("Loaded " + graphResults.length + " graphs");
        })
        .then(function() {
            return [store.getTaskDefinitions(), store.getGraphDefinitions()];
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
