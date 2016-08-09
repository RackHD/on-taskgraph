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

    /**
     * @param {Object} definition - the JSON graph definition that the TaskGraph
     *                              object is created with
     * @param {String} domain - The TaskScheduler/TaskRunner domain within which
     *                          the service graph should be run
     */
    exports.createAndRunServiceGraph = function(definition, domain) {
        return TaskGraph.create(domain, { definition: definition })
        .then(function(graph) {
            if (graph._status === Constants.Task.States.Pending) {
              graph._status = Constants.Task.States.Running;
            }
            return graph.persist();
        })
        .then(function(graph) {
            return taskGraphProtocol.runTaskGraph(graph.instanceId);
        });
    };

    /**
     * A service graph is a graph that should always be running, for example
     * any ongoing daemon that has been implemented with the workflow engine. The IPMI
     * and SNMP poller graphs are an example.
     *
     * Find all graphs with serviceGraph: true in their definition and run
     * them on startup. The following logic is used to determine when and what should be run:
     *
     * - If there is NO active service graph matching the definition.injectableName, create
     *   and run one.
     *
     * - If there IS an active service graph matching the definition.injectableName, do
     *   nothing.
     *
     * - If there IS an active service graph matching the definition.injectableName, but
     *   the two graph definitions do not match, cancel the active graph, delete its record,
     *   and start a new one from the loaded definition.
     *   This is essentially migration if service graph definitions are updated
     *   in new versions of the code.
     *
     * - If there is a failed service graph matching the definition.injectableName, then
     *   delete it from the store and start a new instance of the graph.
     *
     * - If there are any active service graphs running that a definition no longer exists
     *   for, cancel them and delete their documents. This is another migration case.
     */
    exports.start = function(domain) {
        domain = domain || Constants.Task.DefaultDomain;

        return Promise.all([store.getGraphDefinitions(), store.getServiceGraphs()])
        .spread(function(graphDefinitions, serviceGraphs) {
            var serviceGraphDefinitions = _.filter(graphDefinitions, function(graph) {
                return graph.serviceGraph;
            });

            var groups = _.transform(serviceGraphs, function(result, graph) {
                if (_.contains(Constants.Task.FailedStates, graph._status)) {
                    result.failed[graph.injectableName] = graph;
                } else if (_.contains(Constants.Task.ActiveStates, graph._status)) {
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
