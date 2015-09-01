// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint: node:true */

'use strict';

var di = require('di');

module.exports = ServiceGraph;

di.annotate(ServiceGraph, new di.Provide('TaskGraph.ServiceGraph'));
di.annotate(ServiceGraph, new di.Inject(
        'TaskGraph.Registry',
        'Logger',
        'Promise',
        '_'
    )
);
function ServiceGraph(registry, Logger, Promise, _) {
    var logger = Logger.initialize(ServiceGraph);

    function createAndRunServiceGraph(definition, options) {
        var graph = registry.fetchGraphSync(definition.injectableName).create(options, {});

        graph.on(graph.completeEventString, function() {
            logger.warning(
                'Service graph %s has completed with status %s. '
                .format(graph.definition.injectableName, graph._status) +
                'Restarting graph...');

            createAndRunServiceGraph(graph.definition, graph.definition.options)
            .catch(function(error) {
                logger.error('Failed to restart service graph ' + graph.definition.injectableName, {
                    graphId: graph.instanceId,
                    injectableName: graph.definition.injectableName,
                    error: error
                });
            });
        });

        return graph.start();
    }

    function start() {
        return registry.fetchGraphDefinitionCatalog({ serviceGraph: true })
        .then(function(graphs) {
            return [graphs, registry.fetchGraphHistory({ serviceGraph: true })];
        })
        .spread(function(graphDefinitions, graphObjects) {
            return Promise.map(graphDefinitions, function(def) {
                var preExistingGraph = _.find(graphObjects, function(obj) {
                    return obj.injectableName === def.injectableName;
                });

                var options = {};

                if (!_.isEmpty(preExistingGraph)) {
                    options.instanceId = preExistingGraph.instanceId;
                }

                return createAndRunServiceGraph(def, options);
            });
        });
    }

    function stop() {
        var graphs = registry.fetchActiveGraphsSync();
        var serviceGraphs = _.filter(graphs, function(graph) {
            return graph.serviceGraph;
        });
        return Promise.map(serviceGraphs, function(graph) {
            return graph.stop();
        });
    }

    return {
        _createAndRunServiceGraph: createAndRunServiceGraph,
        start: start,
        stop: stop
    };
}
