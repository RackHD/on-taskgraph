// Copyright 2014, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

require('../helper');
var di = require('di');
var _ = require('lodash');
var Q = require('q');
var tasks = require('renasar-tasks');

describe("Task Graph", function () {
    di.annotate(testJobFactory, new di.Provide('Job.test'));
    function testJobFactory() {
        function TestJob(options, context) {
            this.options = options;
            this.context = context;
        }
        TestJob.prototype.run = function() {
            console.log("RUNNING TEST JOB");
            console.log("TEST JOB OPTIONS: " + this.options);
            return Q.delay(500);
        };
        TestJob.prototype.cancel = function() {
            return Q.resolve();
        };
        TestJob.create = function(options, context) {
            return new TestJob(options, context);
        };

        return TestJob;
    }
    var baseTask = {
        friendlyName: 'Test task',
        injectableName: 'Task.Base.test',
        runJob: 'Job.test',
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
        ]
    };

    before(function() {
        this.timeout(5000);
        this.injector = helper.baseInjector.createChild(
            _.flatten([
                tasks.injectables,
                helper.require('/lib/task-graph'),
                helper.require('/lib/task-graph-runner'),
                helper.require('/lib/task-graph-subscriptions'),
                helper.require('/lib/loader'),
                helper.require('/lib/scheduler'),
                helper.require('/lib/registry'),
                testJobFactory
            ])
        );
        this.registry = this.injector.get('TaskGraph.Registry');
        return this.injector.get('TaskGraph.Runner').start();
    });

    after(function() {
        // return this.injector.get('TaskGraph.Runner').stop();
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
        var graphFactory = this.registry. fetchGraph('Graph.test');
        var graph = graphFactory.create();

        graph._populateTaskData();

        expect(graph.tasks).to.be.ok;
        expect(_.keys(graph.tasks)).to.have.length(2);

        var taskWithDependencies,
            taskWithNoDependencies;

        _.forEach(graph.tasks, function(v) {
            if (_.isEmpty(v.waitingOn)) {
                taskWithNoDependencies = v;
            } else {
                taskWithDependencies = v;
            }
        });
        expect(taskWithDependencies).to.be.ok;
        expect(taskWithNoDependencies).to.be.ok;

        expect(taskWithDependencies.instanceId).to.be.a.uuid;
        expect(taskWithNoDependencies.instanceId).to.be.a.uuid;

        expect(taskWithNoDependencies.waitingOn).to.be.empty;
        expect(taskWithDependencies.waitingOn).to.have.property(
            taskWithNoDependencies.instanceId
        ).that.equals('finished');
    });

    it("should find ready tasks", function() {
        var TaskGraph = this.injector.get('TaskGraph.TaskGraph');
        var Task = this.injector.get('Task.Task');
        var loader = this.injector.get('TaskGraph.DataLoader');
        loader.loadTasks([baseTask, testTask], Task.createRegistryObject);
        loader.loadGraphs([graphDefinition], TaskGraph.createRegistryObject);
        var graphFactory = this.registry.fetchGraph('Graph.test');
        var graph = graphFactory.create();
        graph._populateTaskData();

        var taskWithDependencies,
            taskWithNoDependencies;

        _.forEach(graph.tasks, function(v) {
            if (_.isEmpty(v.waitingOn)) {
                taskWithNoDependencies = v;
            } else {
                taskWithDependencies = v;
            }
        });

        graph._findReadyTasks();

        expect(graph.ready).to.not.be.empty;
        expect(graph.ready).to.have.length(1);
        expect(graph.ready[0]).to.equal(taskWithNoDependencies);

        graph.ready.shift();
        taskWithNoDependencies.state = 'succeeded';

        graph._findReadyTasks();
        expect(graph.ready).to.not.be.empty;
        expect(graph.ready).to.have.length(1);
        expect(graph.ready[0]).to.equal(taskWithDependencies);
    });

    it("should run tasks", function(done) {
        var TaskGraph = this.injector.get('TaskGraph.TaskGraph');
        var Task = this.injector.get('Task.Task');
        var loader = this.injector.get('TaskGraph.DataLoader');
        loader.loadTasks([baseTask, testTask], Task.createRegistryObject);
        loader.loadGraphs([graphDefinition], TaskGraph.createRegistryObject);
        var graphFactory = this.registry.fetchGraph('Graph.test');
        var graph = graphFactory.create();

        graph.on(graph.completeEventString, function() {
            done();
        });

        graph.start();
    });

    it("should share context object between tasks and jobs", function() {
        var self = this;
        var TaskGraph = self.injector.get('TaskGraph.TaskGraph');
        var Task = self.injector.get('Task.Task');
        var loader = self.injector.get('TaskGraph.DataLoader');
        loader.loadTasks([baseTask, testTask], Task.createRegistryObject);
        loader.loadGraphs([graphDefinition], TaskGraph.createRegistryObject);
        var graphFactory = self.registry.fetchGraph('Graph.test');
        var context = { a: 1, b: 2 };
        var graph = graphFactory.create({}, context);

        // Don't worry about checking values because .to.equal checks by reference
        expect(graph).to.have.property('context');
        expect(graph.context).to.equal(context);

        graph._populateTaskData();
        _.forEach(graph.tasks, function(task) {
            expect(task).to.have.property('parentContext');
            expect(task.parentContext).to.equal(context);
            task.instantiateJob();
            expect(task.job.context).to.equal(context);
        });
    });
});
