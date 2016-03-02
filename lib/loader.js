// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di'),
    dihelper = require('on-core')(di).helper,
    // Load all graphs within the on-taskgraph/lib/graphs directory (including nested directories)
    // that match the naming convention '*-graph.js' or '*-graph.json'.
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

    /**
     * File loader class for loading graph definitions off disk, and persisting
     * both graph and task definitions into the store.
     *
     * @constructor
     */
    function Loader() {
        this.graphLibrary = graphLibrary;
        this.taskLibrary = taskLibrary;
    }

    /**
     * Persist task definitions into the store
     *
     * @memberOf Loader
     */
    Loader.prototype.persistTasks = function(definitions) {
        return Promise.map(definitions, function(definition) {
            assert.object(definition);
            assert.string(definition.injectableName);
            return store.persistTaskDefinition(definition);
        });
    };

    /**
     * Persist graph definitions into the store
     *
     * @memberOf Loader
     */
    Loader.prototype.persistGraphs = function(definitions) {
        return Promise.map(definitions, function(definition) {
            assert.object(definition);
            assert.string(definition.injectableName);
            assert.arrayOfObject(definition.tasks);
            return store.persistGraphDefinition(definition);
        });
    };

    /**
     * Object construction helper
     *
     * @memberOf Loader
     */
    Loader.prototype.definitionsArrayToHash = function(data) {
        return _.transform(data, function(result, definition) {
            result[definition.injectableName] = definition;
        }, {});
    };

    /**
     * Merge existing graph and task definitions in the database with
     * the ones found on disk to find outdated definitions.
     *
     * @memberOf Loader
     */
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

    /**
     * Load all graphs within the on-taskgraph/lib/graphs directory (including nested directories)
     * that match the naming convention '*-graph.js' or '*-graph.json' and
     * persist those definitions into the store.
     *
     * @memberOf Loader
     */
    Loader.prototype.load = function() {
        var self = this;

        return Promise.all([
            store.getTaskDefinitions(),
            store.getGraphDefinitions()
        ])
        .spread(function(taskCatalog, graphCatalog) {
            var graphResults = self.mergeDefinitionArrays(self.graphLibrary, graphCatalog);
            var taskResults = self.mergeDefinitionArrays(self.taskLibrary, taskCatalog);
            // Ignore persisting base tasks (task.implementsTask returns undefined in that case)
            taskResults = _.filter(taskResults, function(task) {
                return task.implementsTask;
            });

            return [
                self.persistTasks(taskResults),
                self.persistGraphs(graphResults)
            ];
        })
        .spread(function(taskResults, graphResults) {
            logger.info("Loaded " + taskResults.length + " tasks from Task.taskLibrary dependency");
            logger.info("Loaded " + graphResults.length +
                " graphs matching the pattern 'lib/graphs/**/*-graph.+(js|json)'");
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
