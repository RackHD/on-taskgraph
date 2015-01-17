// Copyright 2014, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

require('../helper');
var _ = require('lodash');
var tasks = require('renasar-tasks');

describe("Task Graph", function () {
    var baseTask = {
        friendlyName: 'Test task',
        injectableName: 'Task.Base.test',
        runJob: 'Task.test',
        requiredOptions: [
            'option1',
            'option2',
            'option3',
        ],
        properties: {
            test: {
                type: 'null'
            }
        }
    };
    var testTask = {
        friendlyName: 'Base test task',
        implementsTask: 'Task.Base.test',
        injectableName: 'Task.test',
        options: {
            option1: 1,
            option2: 2,
            option3: 3
        },
        properties: {
            test: {
                foo: 'bar'
            }
        }
    };
    var graphDefinition = {
        injectableName: 'Graph.test',
        tasks: [
            {
                label: 'test-1',
                taskName: 'Task.test'
            },
            {
                label: 'test-2',
                taskName: 'Task.test',
                waitOn: {
                    'test-1': 'finished'
                }
            }
        ],
    };

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
        this.registry = this.injector.get('TaskGraph.Registry');
    });

    it("should load a task graph data file", function() {
        var TaskGraph = this.injector.get('TaskGraph.TaskGraph');
        var graph = TaskGraph.create(graphDefinition);

        expect(graph.options.injectableName).to.equal(graphDefinition.injectableName);
        expect(graph.options.tasks).to.deep.equal(graphDefinition.tasks);
    });

    it("should populate the dependencies of its tasks", function() {
        var TaskGraph = this.injector.get('TaskGraph.TaskGraph');
        var Task = this.injector.get('Task.Task');
        var loader = this.injector.get('TaskGraph.DataLoader');
        loader.loadTasks([baseTask, testTask], Task.createRegistryObject);
        loader.loadGraphs([graphDefinition], TaskGraph.createRegistryObject);
        var graphFactory = this.registry.fetchGraph('Graph.test');
        var graph = graphFactory.create();

        graph.populateTaskDependencies();

        expect(graph.tasks).to.be.ok;
        expect(graph.tasks[0]).to.be.ok;
        expect(graph.tasks[0].instanceId).to.be.a.uuid;
        expect(graph.tasks[1]).to.be.ok;
        expect(graph.tasks[1].instanceId).to.be.ok;
        expect(graph.tasks[0].waitingOn).to.be.empty;
        expect(graph.tasks[1].waitingOn).to.have.property(
            graph.tasks[0].instanceId
        ).that.equals('finished');
    });
});
