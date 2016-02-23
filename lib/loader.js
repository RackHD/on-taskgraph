// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di'),
    dihelper = require('on-core')(di).helper,
    graphLibrary = dihelper.requireGlob(__dirname + '/graphs/**/*-graph.+(js|json)');

module.exports = loaderFactory;
di.annotate(loaderFactory, new di.Provide('TaskGraph.DataLoader'));
di.annotate(loaderFactory, new di.Inject(
    'TaskGraph.Store',
    'Task.taskLibrary',
    'Logger',
    'Assert',
    'Promise',
    '_'
));
function loaderFactory(store, taskLibrary, Logger, assert, Promise, _) {
    var logger = Logger.initialize(loaderFactory);

    function Loader() {
        this.graphLibrary = graphLibrary;
        this.taskLibrary = taskLibrary;
    }

    Loader.prototype.persistTasks = function(definitions) {
        return Promise.map(definitions, function(definition) {
            assert.object(definition);
            assert.string(definition.injectableName);
            return store.persistTaskDefinition(definition);
        });
    };

    Loader.prototype.persistGraphs = function(definitions) {
        return Promise.map(definitions, function(definition) {
            assert.object(definition);
            assert.string(definition.injectableName);
            assert.arrayOfObject(definition.tasks);
            return store.persistGraphDefinition(definition);
        });
    };

    Loader.prototype.definitionsArrayToHash = function(data) {
        return _.transform(data, function(result, definition) {
            result[definition.injectableName] = definition;
        }, {});
    };

    Loader.prototype.mergeDefinitionArrays = function(overlay, base) {
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

    Loader.prototype.load = function() {
        var self = this;

        return Promise.all([
            store.getTaskDefinitions(),
            store.getGraphDefinitions()
        ])
        .spread(function(taskCatalog, graphCatalog) {
            var graphResults = self.mergeDefinitionArrays(self.graphLibrary, graphCatalog);
            var taskResults = self.mergeDefinitionArrays(self.taskLibrary, taskCatalog);
            taskResults = _.filter(taskResults, function(task) {
                return task.implementsTask;
            });

            return [
                self.persistTasks(taskResults),
                self.persistGraphs(graphResults)
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
