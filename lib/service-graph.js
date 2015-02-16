// Copyright 2014-2015, Renasar Technologies Inc.
/* jshint: node:true */

'use strict';

var di = require('di');

module.exports = ServiceGraph;

di.annotate(ServiceGraph, new di.Provide('TaskGraph.ServiceGraph'));
di.annotate(ServiceGraph, new di.Inject(
        'TaskGraph.Registry',
        'Q',
        '_'
    )
);
function ServiceGraph(registry, Q, _) {
    function start() {
        return registry.fetchGraphDefinitionCatalog({ serviceGraph: true })
        .then(function(graphs) {
            return [graphs, registry.fetchGraphHistory({ serviceGraph: true })];
        })
        .spread(function(graphDefinitions, graphObjects) {
            return Q.all(_.map(graphDefinitions, function(def) {
                var preExistingGraph = _.find(graphObjects, function(obj) {
                    return obj.injectableName === def.injectableName;
                });
                var options = {};
                if (!_.isEmpty(preExistingGraph)) {
                    options.instanceId = preExistingGraph.instanceId;
                }

                var graph = registry.fetchGraphSync(def.injectableName).create(options, {});
                return graph.start();
            }));
        });
    }

    function stop() {
        var graphs = registry.fetchActiveGraphsSync();
        var serviceGraphs = _.filter(graphs, function(graph) {
            return graph.serviceGraph;
        });
        return Q.all(_.map(serviceGraphs, function(graph) {
            return graph.stop();
        }));
    }

    return {
        start: start,
        stop: stop
    };
}
