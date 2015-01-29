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
    di.annotate(testJobFactory, new di.Inject('Job.Base', 'Logger', 'Util', 'uuid'));
    function testJobFactory(BaseJob, Logger, util, uuid) {
        var logger = Logger.initialize(testJobFactory);
        function TestJob(options, context, taskId) {
            options = options || {};
            context = context || {};
            taskId = taskId || uuid.v4();
            TestJob.super_.call(this, logger, options, context, taskId);
        }
        util.inherits(TestJob, BaseJob);

        TestJob.prototype._run = function() {
            var self = this;
            console.log("RUNNING TEST JOB");
            console.log("TEST JOB OPTIONS: " + self.options);
            Q.delay(500).then(function() {
                self._done();
            });
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
        requiredProperties: {},
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
        this.TaskGraph = this.injector.get('TaskGraph.TaskGraph');
        this.Task = this.injector.get('Task.Task');
        this.loader = this.injector.get('TaskGraph.DataLoader');
        this.loader.loadTasks([baseTask, testTask], this.Task.createRegistryObject);
        this.loader.loadGraphs([graphDefinition], this.TaskGraph.createRegistryObject);
        return this.injector.get('TaskGraph.Runner').start();
    });

    after(function() {
        // return this.injector.get('TaskGraph.Runner').stop();
    });

    describe("Validation", function() {
        it("should get a base task", function() {
            var graphFactory = this.registry.fetchGraph('Graph.test');
            var graph = graphFactory.create();

            var firstTask = graph.options.tasks[0];
            var taskDefinition = this.registry.fetchTask(firstTask.taskName).definition;
            var _baseTask = graph._getBaseTask(taskDefinition);

            expect(_baseTask).to.be.an.object;
            expect(_baseTask.injectableName).to.equal(taskDefinition.implementsTask);
        });

        it("should validate a task definition", function() {
            var graphFactory = this.registry.fetchGraph('Graph.test');
            var graph = graphFactory.create();

            var firstTask = graph.options.tasks[0];
            var taskDefinition = this.registry.fetchTask(firstTask.taskName).definition;

            expect(function() {
                graph._validateTaskDefinition(taskDefinition);
            }).to.not.throw(Error);

            _.forEach(_.keys(taskDefinition), function(key) {
                expect(function() {
                    var _definition = _.omit(taskDefinition, key);
                    graph._validateTaskDefinition(_definition);
                }).to.throw(Error);
            });

            _.forEach(_.keys(taskDefinition), function(key) {
                expect(function() {
                    var _definition = _.cloneDeep(taskDefinition);
                    // Assert bad types, we won't expect any of our values to be
                    // functions
                    _definition[key] = function() {};
                    graph._validateTaskDefinition(_definition);
                }).to.throw(/required/);
            });
        });

        it("should validate task properties", function() {
            var baseTask1 = {
                friendlyName: 'base test task properties 1',
                injectableName: 'Task.Base.testProperties1',
                runJob: 'Job.test',
                requiredOptions: [],
                requiredProperties: {},
                properties: {
                    test: {
                        type: 'null'
                    },
                    fresh: {
                        fruit: {
                            slices: 'sugary'
                        }
                    },
                    fried: {
                        chicken: {
                            and: {
                                waffles: 'yum'
                            }
                        }
                    }
                }
            };
            var baseTask2 = {
                friendlyName: 'base test task properties 2',
                injectableName: 'Task.Base.testProperties2',
                runJob: 'Job.test',
                requiredOptions: [],
                requiredProperties: {
                    // test multiple levels of nesting
                    'pancakes': 'syrup',
                    'spam.eggs': 'monty',
                    'fresh.fruit.slices': 'sugary',
                    'fried.chicken.and.waffles': 'yum',
                    'coffee.with.cream.and.sugar': 'wake up'
                },
                properties: {
                    test: {
                        type: 'null'
                    }
                }
            };
            var baseTask3 = {
                friendlyName: 'base test task properties 3',
                injectableName: 'Task.Base.testProperties3',
                runJob: 'Job.test',
                requiredOptions: [],
                requiredProperties: {
                    'does.not.exist': 'negative'
                },
                properties: {
                    test: {
                        type: 'null'
                    }
                }
            };
            var testTask1 = {
                friendlyName: 'test properties task 1',
                implementsTask: 'Task.Base.testProperties1',
                injectableName: 'Task.testProperties1',
                options: {},
                properties: {
                    test: {
                        unit: 'properties',
                    },
                    pancakes: 'syrup',
                    spam: {
                        eggs: 'monty'
                    },
                    coffee: {
                        'with': {
                            cream: {
                                and: {
                                    sugar: 'wake up'
                                }
                            }
                        }
                    }
                }
            };
            var testTask2 = {
                friendlyName: 'test properties task 2',
                implementsTask: 'Task.Base.testProperties2',
                injectableName: 'Task.testProperties2',
                options: {},
                properties: {
                    test: {
                        foo: 'bar'
                    }
                }
            };
            var testTask3 = {
                friendlyName: 'test properties task 3',
                implementsTask: 'Task.Base.testProperties3',
                injectableName: 'Task.testProperties3',
                options: {},
                properties: {
                    test: {
                        bar: 'baz'
                    }
                }
            };
            var graphDefinitionValid = {
                injectableName: 'Graph.testPropertiesValid',
                tasks: [
                    {
                        label: 'test-1',
                        taskName: 'Task.testProperties1'
                    },
                    {
                        label: 'test-2',
                        taskName: 'Task.testProperties2',
                        waitOn: {
                            'test-1': 'finished'
                        }
                    }
                ]
            };
            var graphDefinitionInvalid = {
                injectableName: 'Graph.testPropertiesInvalid',
                tasks: [
                    {
                        label: 'test-1',
                        taskName: 'Task.testProperties1'
                    },
                    {
                        label: 'test-2',
                        taskName: 'Task.testProperties2',
                        waitOn: {
                            'test-1': 'finished'
                        }
                    },
                    {
                        label: 'test-3',
                        taskName: 'Task.testProperties3',
                        waitOn: {
                            'test-2': 'finished'
                        }
                    }
                ]
            };
            this.loader.loadTasks([
                    baseTask1, baseTask2, baseTask3,
                    testTask1, testTask2, testTask3
                ], this.Task.createRegistryObject);
            this.loader.loadGraphs([graphDefinitionValid, graphDefinitionInvalid],
                    this.TaskGraph.createRegistryObject);
            var graphFactory = this.registry.fetchGraph('Graph.testPropertiesValid');
            var graph = graphFactory.create();

            var firstTask = graph.options.tasks[0];
            var taskDefinition = this.registry.fetchTask(firstTask.taskName).definition;

            var context = {};
            expect(function() {
                graph._validateProperties(taskDefinition, context);
            }).to.not.throw(Error);
            expect(context).to.have.property('properties')
                .that.deep.equals(taskDefinition.properties);

            var secondTask = graph.options.tasks[1];
            var taskDefinition2 = this.registry.fetchTask(secondTask.taskName).definition;
            expect(function() {
                graph._validateProperties(taskDefinition2, context);
            }).to.not.throw(Error);

            graphFactory = this.registry.fetchGraph('Graph.testPropertiesInvalid');
            var invalidGraph = graphFactory.create();

            var thirdTask = invalidGraph.options.tasks[2];
            taskDefinition = this.registry.fetchTask(thirdTask.taskName).definition;

            context = {};
            expect(function() {
                graph._validateProperties(taskDefinition, context);
            }).to.throw(Error);
        });

        it("should validate a graph", function() {
            var graphFactory = this.registry.fetchGraph('Graph.test');
            var graph = graphFactory.create();

            expect(function() {
                graph.validate();
            }).to.not.throw(Error);
        });
    });

    it("should load a task graph data file", function() {
        var graph = this.TaskGraph.create(graphDefinition);

        expect(graph.options.injectableName).to.equal(graphDefinition.injectableName);
        expect(graph.options.tasks).to.deep.equal(graphDefinition.tasks);
    });

    it("should populate the dependencies of its tasks", function() {
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
        this.timeout(5000);
        var graphFactory = this.registry.fetchGraph('Graph.test');
        var graph = graphFactory.create();

        graph.on(graph.completeEventString, function() {
            done();
        });

        graph.start();
    });

    it("should share context object between tasks and jobs", function() {
        var self = this;
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
