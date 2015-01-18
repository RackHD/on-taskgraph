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

/**
 * Injectable wrapper for dependencies
 * @param logger
 */
function factory(assert, _) {
    var graphLibraryStore = new Store(_);
    var taskLibraryStore = new Store(_);
    var runningGraphStore = new Store(_);

    return {
        registerTask: function(task) {
            assert.object(task);
            assert.object(task.definition);
            assert.string(task.definition.injectableName);
            assert.func(task.create);

            taskLibraryStore.put(task.definition.injectableName, task);
        },
        registerGraph: function(graph) {
            assert.object(graph);
            assert.object(graph.definition);
            assert.string(graph.definition.injectableName);
            assert.func(graph.create);

            graphLibraryStore.put(graph.definition.injectableName, graph);
        },
        fetchTaskCatalog: function(){
            return _.map(taskLibraryStore.getAll(), function(task) {
                return task.definition;
            });
        },
        fetchGraphCatalog: function(){
            return _.map(graphLibraryStore.getAll(), function(graph) {
                return graph.definition;
            });
        },
        fetchTask: function(taskName) {
            return taskLibraryStore.get(taskName);
        },
        fetchGraph: function(graphName) {
            return graphLibraryStore.get(graphName);
        },
        fetchActiveGraph: runningGraphStore.getAll.bind(runningGraphStore),
        defineGraph: function(definition) {
            assert.object(definition);
            assert.string(definition.injectableName);
            assert.arrayOfObject(definition.tasks);

            var graph = factory(definition);

            assert.object(graph.definition);
            assert.func(graph.create);

            graphLibraryStore.put(graph.definition.injectableName, graph);
        },
        putActiveGraph: function(graph) {
            var _id = graph.instanceId;
            graph.on(graph.completeEventString, function() {
                runningGraphStore.remove(_id);
            });
            runningGraphStore.put(graph.instanceId, graph);
        }
    };
}

// Placeholder for a more sophisticated persistence store
function Store (_){
    this.store = {};
    this._ = _;
}

Store.prototype.put = function(name, value) {
    this.store[name] = value;
};

Store.prototype.get = function(name) {
    return this.store[name];
};

Store.prototype.getAll = function(filter) {
    //TODO: implement filter once design is agreed, for now return all
    filter;
    return this._.values(this.store);
};

Store.prototype.remove = function(name) {
    delete this.store[name];
    return this;
};
