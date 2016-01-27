// Copyright 2015-2016, EMC, Inc.

'use strict';

var di = require('di');

module.exports = ServiceGraph;

di.annotate(ServiceGraph, new di.Provide('TaskGraph.ServiceGraph'));
di.annotate(ServiceGraph, new di.Inject(
        'TaskGraph.TaskGraph',
        'TaskGraph.Store',
        'Protocol.TaskGraphRunner',
        'Constants',
        'Promise',
        '_'
    )
);
function ServiceGraph(TaskGraph, store, taskGraphProtocol, Constants, Promise, _) {
    var exports = {};

    exports.createAndRunServiceGraph = function(definition, domain) {
        return TaskGraph.create(domain, { definition: definition })
        .then(function(graph) {
            return graph.persist();
        })
        .then(function(graph) {
            return taskGraphProtocol.runTaskGraph(graph.instanceId);
        });
    };

    exports.start = function(domain) {
        domain = domain || Constants.DefaultTaskDomain;

        return Promise.all([store.getGraphDefinitions(), store.getServiceGraphs()])
        .spread(function(graphDefinitions, serviceGraphs) {
            var serviceGraphDefinitions = _.filter(graphDefinitions, function(graph) {
                return graph.serviceGraph;
            });

            var groups = _.transform(serviceGraphs, function(result, graph) {
                if (_.contains(Constants.FailedTaskStates, graph._status)) {
                    result.failed[graph.injectableName] = graph;
                } else if (_.contains(Constants.TaskStates.Pending, graph._status)) {
                    result.running[graph.injectableName] = graph;
                }
            }, { failed: {}, running: {} });

            return Promise.map(serviceGraphDefinitions, function(def) {
                var activeGraph = groups.running[def.injectableName];
                if (activeGraph) {
                    // Migrate running service graphs if the definition has changed from
                    // the currently active one
                    if (!_.isEqual(activeGraph.definition, def)) {
                        return taskGraphProtocol.cancelTaskGraph(activeGraph.instanceId)
                        .then(function() {
                            return store.deleteGraph(groups.running[def.injectableName].instanceId);
                        })
                        .then(function() {
                            delete groups.running[def.injectableName];
                            return exports.createAndRunServiceGraph(def, domain);
                        });
                    }
                    delete groups.running[def.injectableName];
                    return;
                }
                if (_.contains(_.keys(groups.failed), def.injectableName)) {
                    return store.deleteGraph(groups.failed[def.injectableName].instanceId)
                    .then(function() {
                        delete groups.failed[def.injectableName];
                        return exports.createAndRunServiceGraph(def, domain);
                    });
                }
                delete groups.running[def.injectableName];
                return exports.createAndRunServiceGraph(def, domain);
            })
            .then(function() {
                // Delete service graphs for which there is no definition
                // (i.e. migrate old graphs out of existence)
                return Promise.all(_.map(groups.running, function(graph) {
                    return taskGraphProtocol.cancelTaskGraph(graph.instanceId)
                    .then(function() {
                        return store.deleteGraph(graph.instanceId);
                    });
                }));
            });
        });
    };

    exports.stop = function() {
        return store.getServiceGraphs()
        .then(function(graphs) {
            return Promise.map(graphs, function(graph) {
                return taskGraphProtocol.cancelTaskGraph(graph.instanceId);
            });
        });
    };

    return exports;
}
