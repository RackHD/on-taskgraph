// Copyright 2014, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

require('../helper');
var _ = require('lodash');
var tasks = require('renasar-tasks');

describe("Task Graph", function () {
    before(function() {
        this.injector = helper.baseInjector.createChild(
            _.flatten([
                tasks.injectables,
                helper.require('/lib/task-graph'),
                helper.require('/lib/task-graph-runner'),
                helper.require('/lib/task-graph-subscriptions'),
                helper.require('/lib/loader'),
                helper.require('/lib/scheduler'),
                helper.require('/lib/registry')
            ])
        );
    });

    it("should load a task graph data file", function() {
        var graphDefinition = {
            injectableName: 'Graph.test1',
            tasks: [
                {
                    label: 'noop-1',
                    taskName: 'Task.Base.noop'
                },
                {
                    label: 'noop-2',
                    taskName: 'Task.Base.noop',
                    waitOn: {
                        'noop-1': 'finished'
                    }
                }
            ],
        };
        var TaskGraph = this.injector.get('TaskGraph.TaskGraph');
        var graph = TaskGraph.create(graphDefinition);

        expect(graph.options.injectableName).to.equal(graphDefinition.injectableName);
        expect(graph.options.tasks).to.deep.equal(graphDefinition.tasks);
    });
});
