// Copyright 2014, Renasar Technologies Inc.
/* jshint: node:true */
'use strict';

var di = require('di');

module.exports = factory;
di.annotate(factory, new di.Provide('TaskGraph.Registry'));
di.annotate(factory,
    new di.Inject(
        'TaskGraph.Stores.Memory',
        'TaskGraph.Stores.Waterline',
        'Assert',
        'Q',
        '_'
    )
);

/**
 * Injectable wrapper for dependencies
 */
function factory(MemoryStore, WaterlineStore, assert, Q, _) {
    function Registry() {
    }

    Registry.prototype.registerTask = function(taskRegistryObject) {
        var self = this;
        // Waterline likes to modify our objects by reference, guard against that
        var definition = _.cloneDeep(taskRegistryObject.definition);
        assert.object(definition);
        assert.string(definition.injectableName);
        assert.func(taskRegistryObject.create);

        self.taskFactoryStore.put(definition.injectableName, taskRegistryObject);

        return Q.resolve()
        .then(function() {
            if (_.has(definition, 'implementsTask')) {
                return self.taskDefinitionStore.put(definition.injectableName, definition);
            } else {
                return self.baseTaskDefinitionStore.put(definition.injectableName, definition);
            }
        });
    };

    Registry.prototype.registerGraph = function(graphRegistryObject) {
        var definition = graphRegistryObject.definition;
        assert.object(definition);
        assert.string(definition.injectableName);
        assert.func(graphRegistryObject.create);

        this.graphFactoryStore.put(definition.injectableName, graphRegistryObject);
        return this.graphDefinitionStore.put(definition.injectableName, definition);
    };

    Registry.prototype.fetchTaskDefinitionCatalog = function(){
        var self = this;

        return self.taskDefinitionStore.getAll()
        .then(function(definitions) {
            return definitions.concat(self.baseTaskDefinitionStore.getAll());
        });
    };

    Registry.prototype.fetchGraphDefinitionCatalog = function(){
        return this.graphDefinitionStore.getAll();
    };

    Registry.prototype.fetchBaseTaskDefinitionSync = function(taskName) {
        return this.baseTaskDefinitionStore.get(taskName);
    };

    Registry.prototype.fetchTaskSync = function(taskName) {
        return this.taskFactoryStore.get(taskName);
    };

    Registry.prototype.removeTaskSync = function(taskName) {
        return this.taskFactoryStore.remove(taskName);
    };

    Registry.prototype.fetchGraphSync = function(graphName) {
        return this.graphFactoryStore.get(graphName);
    };

    Registry.prototype.removeGraphSync = function(graphName) {
         return this.graphFactoryStore.remove(graphName);
    };

    Registry.prototype.fetchTaskDefinition = function(taskName) {
        return this.taskDefinitionStore.get(taskName);
    };

    Registry.prototype.removeTaskDefinition = function(taskName) {
        return this.taskDefinitionStore.remove(taskName);
    };

    Registry.prototype.fetchGraphDefinition = function(graphName) {
        return this.graphDefinitionStore.get(graphName);
    };

    Registry.prototype.removeGraphDefinition = function(graphName) {
        return this.graphDefinitionStore.remove(graphName);
    };

    Registry.prototype.fetchActiveGraphSync = function(filter) {
        filter = filter || {};
        if (filter.target) {
            var graphId = this.graphTargetStore.get(filter.target);
            return this.runningGraphStore.get(graphId);
        } else if (filter.instanceId) {
            return this.runningGraphStore.get(filter.instanceId);
        } else {
            return;
        }
    };

    Registry.prototype.fetchActiveGraphsSync = function(filter) {
        return this.runningGraphStore.getAll(filter);
    };

    Registry.prototype.putActiveGraphSync = function(graph, target) {
        var self = this;

        // TODO: For now, do a blanket "one per" rule, in the future we will want
        // to be more discerning once we expand beyond nodes
        if (target && this.graphTargetStore.get(target)) {
            throw new Error("Unable to run multiple task graphs against a single target.");
        }
        var _id = graph.instanceId;
        graph.on(graph.completeEventString, function() {
            self.runningGraphStore.remove(_id);
            self.graphTargetStore.remove(target);
        });
        this.runningGraphStore.put(graph.instanceId, graph);
        this.graphTargetStore.put(target, graph.instanceId);
    };

    Registry.prototype.hasActiveGraphSync = function(target) {
        return this.graphTargetStore.get(target);
    };

    Registry.prototype.start = function() {
        this.baseTaskDefinitionStore = new MemoryStore();
        this.taskDefinitionStore = new WaterlineStore('taskdefinitions', 'injectableName');
        this.graphDefinitionStore = new WaterlineStore('graphdefinitions', 'injectableName');

        this.taskFactoryStore = new MemoryStore();
        this.graphFactoryStore = new MemoryStore();

        this.runningGraphStore = new MemoryStore();
        this.graphTargetStore = new MemoryStore();
    };

    Registry.prototype.stop = function() {
        this.baseTaskDefinitionStore = undefined;
        this.taskDefinitionStore = undefined;
        this.graphDefinitionStore = undefined;

        this.taskFactoryStore = undefined;
        this.graphFactoryStore = undefined;

        this.runningGraphStore = undefined;
        this.graphTargetStore = undefined;
    };

    return new Registry();
}
