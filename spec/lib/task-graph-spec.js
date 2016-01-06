// Copyright 2015, EMC, Inc.
/* jshint node:true */

'use strict';

describe("Task Graph", function () {
    var runner;
    var registry;
    var TaskGraph;
    var Task;
    var loader;
    var Promise;

    function findAllValues(obj) {
        var allValues = _.map(obj, function(v) {
            if (v !== null && typeof v === 'object') {
                return findAllValues(v);
            } else {
                return v;
            }
        });
        return _.flattenDeep(allValues);
    }

    function literalCompare(objA, objB) {
        _.forEach(objA, function(v, k) {
            if (_.contains(['renderContext', 'subscriptions' ,'_events', '_cancellable'], k)) {
                return;
            }
            if (typeof v === 'object' && !(v instanceof Date)) {
                literalCompare(v, objB[k]);
            } else {
                expect(v).to.deep.equal(objB[k]);
            }
        });
    }

    // The only values currently that won't compare accurately from JSON to
    // object are Date objects, so do some manual conversion there.
    function deserializeJson(json) {
        _.forEach(json, function(v, k) {
            if (!_.contains(['tasks', 'finishedTasks', 'pendingTasks'], k)) {
                return;
            }
            _.forEach(v, function(_v, _k) {
                _.forEach(_v.stats, function(__v, __k) {
                    if (__v) {
                        v[_k].stats[__k] = new Date(__v);
                    }
                });

            });
        });
    }

    function cleanupTestDefinitions(self) {
        return Promise.all(_.map(self.testGraphs, function(graph) {
            return registry.removeGraphDefinition(graph);
        }))
        .then(function() {
            return Promise.all(_.map(self.testTasks, function(task) {
                return registry.removeTaskDefinition(task);
            }));
        })
        .then(function() {
            self.testTasks = [];
            self.testGraphs = [];
        });
    }

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
            setTimeout(function() {
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
    var baseTaskEmpty = {
        friendlyName: 'Test task empty',
        injectableName: 'Task.Base.test-empty',
        runJob: 'Job.test',
        requiredOptions: [],
        requiredProperties: {},
        properties: {}
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
        friendlyName: 'Test Graph',
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
        friendlyName: 'Valid Test Graph',
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
        friendlyName: 'Invalid Test Graph',
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

    var graphDefinitionOptions = {
        injectableName: 'Graph.testGraphOptions',
        friendlyName: 'Test Graph Options',
        options: {
            defaults: {
                option1: 'same for all',
                option2: 'same for all',
                'optionNonExistant': 'not in any'
            },
            'test-2': {
                overrideOption: 'overridden for test-2',
                option2: 'overridden default option for test-2'
            },
            'test-3': {
                inlineOptionOverridden: 'overridden inline option for test-3'
            },
            'test-4': {
                nonRequiredOption: 'add an option to an empty base task'
            }
        },
        tasks: [
            {
                label: 'test-1',
                taskName: 'Task.test',
                optionOverrides: {
                    'testName': 'firstTask'
                }
            },
            {
                label: 'test-2',
                taskName: 'Task.test',
                optionOverrides: {
                    'testName': 'secondTask',
                    overrideOption: undefined
                },
                waitOn: {
                    'test-1': 'finished'
                }
            },
            {
                label: 'test-3',
                taskDefinition: {
                    friendlyName: 'Test Inline Task',
                    injectableName: 'Task.test.inline-task',
                    implementsTask: 'Task.Base.test',
                    options: {
                        option3: 3,
                        inlineOption: 3,
                        inlineOptionOverridden: undefined,
                        testName: 'thirdTask'
                    },
                    properties: {}
                }
            },
            {
                label: 'test-4',
                taskDefinition: {
                    friendlyName: 'Test Inline Task no options',
                    injectableName: 'Task.test.inline-task-no-opts',
                    implementsTask: 'Task.Base.test-empty',
                    options: {},
                    properties: {}
                }
            }
        ]
    };

    before(function() {
        var self = this;
        var tasks = require('on-tasks');

        self.timeout(10000);
        helper.setupInjector(_.flattenDeep([
            tasks.injectables,
            helper.require('/lib/task-graph'),
            helper.require('/lib/task-graph-runner'),
            helper.require('/lib/task-graph-subscriptions'),
            helper.require('/lib/service-graph'),
            helper.require('/lib/loader'),
            helper.require('/lib/scheduler'),
            helper.require('/lib/registry'),
            helper.require('/lib/stores/waterline'),
            helper.require('/lib/stores/memory'),
            helper.di.overrideInjection(testJobFactory, 'Job.test',
                ['Job.Base', 'Logger', 'Util', 'uuid'])
        ]));

        helper.setupTestConfig();

        Promise = helper.injector.get('Promise');

        var Logger = helper.injector.get('Logger');
        Logger.prototype.log = function(level, message, obj) {
            console.log(message, obj);
        };

        runner = helper.injector.get('TaskGraph.Runner');
        registry = helper.injector.get('TaskGraph.Registry');
        TaskGraph = helper.injector.get('TaskGraph.TaskGraph');
        Task = helper.injector.get('Task.Task');
        loader = helper.injector.get('TaskGraph.DataLoader');

        // Don't run service graphs on start in test
        var serviceGraph = helper.injector.get('TaskGraph.ServiceGraph');
        serviceGraph.start = sinon.stub();

        return runner.start()
        .then(function() {
            return loader.loadTasks([baseTask, testTask], Task.createRegistryObject);
        })
        .then(function() {
            return loader.loadGraphs([graphDefinition], TaskGraph.createRegistryObject);
        })
        .catch(function(e) {
            helper.handleError(e);
        });
    });

    beforeEach(function() {
        this.sandbox = sinon.sandbox.create();
    });

    afterEach(function() {
        this.sandbox.restore();
    });

    after(function() {
        return runner.stop();
    });

    describe("Validation", function() {
        this.testTasks = [];
        this.testGraphs = [];

        afterEach(function() {
            return cleanupTestDefinitions(this);
        });

        it("should validate task labels", function() {
            var graphFactory = registry.fetchGraphSync('Graph.test');
            var graph = graphFactory.create();
            graph.definition.tasks.push({
                'label': 'test-duplicate'
            });
            graph.definition.tasks.push({
                'label': 'test-duplicate'
            });
            expect(function() {
                graph._validateTaskLabels();
            }).to.throw(
                /The task label \'test-duplicate\' is used more than once in the graph definition/);
        });

        it("should get a base task", function() {
            var graphFactory = registry.fetchGraphSync('Graph.test');
            var graph = graphFactory.create();

            var firstTask = graph.definition.tasks[0];
            var taskDefinition = registry.fetchTaskSync(firstTask.taskName).definition;

            var baseTaskDefinition = graph._getBaseTask(taskDefinition);

            expect(baseTaskDefinition).to.be.an.object;
            expect(baseTaskDefinition.injectableName).to.equal(taskDefinition.implementsTask);
        });

        it("should validate a task definition", function() {
            var graphFactory = registry.fetchGraphSync('Graph.test');
            var graph = graphFactory.create();

            var firstTask = graph.definition.tasks[0];
            var taskDefinition = registry.fetchTaskSync(firstTask.taskName).definition;

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
            var self = this;

            return loader.loadTasks([
                    baseTask1, baseTask2, baseTask3,
                    testTask1, testTask2, testTask3
                ], Task.createRegistryObject)
            .then(function() {
                return loader.loadGraphs([graphDefinitionValid, graphDefinitionInvalid],
                        TaskGraph.createRegistryObject);
            })
            .catch(function(e) {
                self.testGraphs.push(graphDefinitionValid.injectableName);
                self.testGraphs.push(graphDefinitionInvalid.injectableName);
                self.testTasks = _.map([baseTask1, baseTask2, baseTask3,
                                        testTask1, testTask2, testTask3], function(task) {
                    return task.injectableName;
                });
                helper.handleError(e);
            })
            .then(function() {
                self.testGraphs.push(graphDefinitionValid.injectableName);
                self.testGraphs.push(graphDefinitionInvalid.injectableName);
                self.testTasks = _.map([baseTask1, baseTask2, baseTask3,
                                        testTask1, testTask2, testTask3], function(task) {
                    return task.injectableName;
                });

                var graphFactory = registry.fetchGraphSync('Graph.testPropertiesValid');
                var graph = graphFactory.create();

                var firstTask = graph.definition.tasks[0];
                var taskDefinition = registry.fetchTaskSync(firstTask.taskName).definition;

                var context = {};
                expect(function() {
                    graph._validateProperties(taskDefinition, context);
                }).to.not.throw(Error);
                expect(context).to.have.property('properties')
                    .that.deep.equals(taskDefinition.properties);

                var secondTask = graph.definition.tasks[1];
                var taskDefinition2 = registry.fetchTaskSync(secondTask.taskName).definition;
                expect(function() {
                    graph._validateProperties(taskDefinition2, context);
                }).to.not.throw(Error);

                graphFactory = registry.fetchGraphSync('Graph.testPropertiesInvalid');
                var invalidGraph = graphFactory.create();

                var thirdTask = invalidGraph.definition.tasks[2];
                taskDefinition = registry.fetchTaskSync(thirdTask.taskName).definition;

                context = {};
                expect(function() {
                    graph._validateProperties(taskDefinition, context);
                }).to.throw(Error);

                _.forEach([baseTask1, baseTask2, baseTask3,
                            testTask1, testTask2, testTask3], function(task) {
                    registry.removeTaskSync(task.injectableName);
                });
                _.forEach([graphDefinitionValid, graphDefinitionInvalid], function(graph) {
                    registry.removeGraphSync(graph.injectableName);
                });
            }).catch(function(e) {
                helper.handleError(e);
            });
        });

        it("should validate a graph", function() {
            var graphFactory = registry.fetchGraphSync('Graph.test');
            var graph = graphFactory.create();

            expect(function() {
                graph.validate();
            }).to.not.throw(Error);
        });

        it("should validate all existing graph definitions not requiring API input", function() {
            return registry.fetchGraphDefinitionCatalog()
            .then(function(graphs) {
                _.forEach(graphs, function(_graph) {
                    var graph = registry.fetchGraphSync(_graph.injectableName).create();
                    if (_.isEmpty(_graph.options)) {
                        // Only validate tasks that don't explicitly have blanks
                        // in their definitions (to be filled in by users)
                        var skip = _.some(_graph.tasks, function(task) {
                            if (task.taskName) {
                                var _task = registry.fetchTaskSync(task.taskName);
                                expect(_task, task.taskName).to.exist;
                                var options = _task.options;
                                return _.contains(findAllValues(options, null));
                            } else if (task.taskDefinition) {
                                return _.contains(findAllValues(task.taskDefinition.options), null);
                            }
                        });
                        if (!skip) {
                            expect(function() {
                                graph.validate();
                            }).to.not.throw(Error);
                        }
                    } else {
                        // Only validate tasks that don't explicitly have blanks
                        // in their definitions (to be filled in by users)
                        if (!_.contains(findAllValues(_graph.options), null)) {
                            expect(function() {
                                graph.validate();
                            }).to.not.throw(Error);
                        }
                    }
                });
            });
        });
    });

    describe("Object Construction", function() {
        before(function() {
            this.testTasks = [];
            this.testGraphs = [];
        });

        afterEach(function() {
            return cleanupTestDefinitions(this);
        });

        it("should render uuids in definition options template values", function() {
            var self = this;
            var assert = helper.injector.get('Assert');

            var graphDefinitionRenderUuid = {
                friendlyName: 'Test Render Uuid Graph',
                injectableName: 'Graph.Test.RenderUuid',
                options: {
                    'test-render-task': {
                        option1: '<%=uuid%>',
                        option2: '<%=uuid%>',
                        option3: '<%=uuid%>'
                    },
                },
                tasks: [
                    {
                        label: 'test-render-task',
                        taskName: 'Task.test'
                    }
                ]
            };

            return loader.loadGraphs([graphDefinitionRenderUuid],
                    TaskGraph.createRegistryObject)
            .catch(function(e) {
                self.testGraphs.push(graphDefinitionRenderUuid.injectableName);
                helper.handleError(e);
            })
            .then(function() {
                self.testGraphs.push(graphDefinitionRenderUuid.injectableName);
                var graphFactory = registry.fetchGraphSync('Graph.Test.RenderUuid');
                var graph = graphFactory.create({}, {});
                graph._populateTaskData();

                for (var taskId in graph.tasks) break; // jshint ignore: line

                _.forEach(['option1', 'option2', 'option3'], function(option) {
                    expect(function() {
                        assert.uuid(graph.definition.options['test-render-task'][option]);
                        assert.uuid(graph.tasks[taskId].options[option]);
                    }).to.not.throw(Error);
                });
            });
        });

        it("should share context object between tasks and jobs", function() {
            var graphFactory = registry.fetchGraphSync('Graph.test');
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

        it("should populate the dependencies of its tasks", function() {
            var graphFactory = registry. fetchGraphSync('Graph.test');
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

        it("should apply options to a graph via the registry factory", function() {
            var graphFactory = registry. fetchGraphSync('Graph.test');
            expect(graphFactory).to.have.property('create').with.length(2);
            var options = {
                defaults: {
                    a: 1
                }
            };
            var graph = graphFactory.create(options);
            expect(graph.definition.options).to.deep.equal(options);
        });

        it("should apply context to a graph via the registry factory", function() {
            var graphFactory = registry. fetchGraphSync('Graph.test');
            var context = {
                target: 'test'
            };
            var graph = graphFactory.create({}, context);
            expect(graph.context).to.deep.equal(context);
        });

        describe("graph level options", function() {
            var firstTask, secondTask, thirdTask, fourthTask;

            before("Graph level options before", function() {
                var self = this;

                return loader.loadGraphs([graphDefinitionOptions],
                        TaskGraph.createRegistryObject)
                .then(function() {
                    return loader.loadTasks([baseTaskEmpty], Task.createRegistryObject);
                })
                .catch(function(e) {
                    self.testGraphs.push(graphDefinitionOptions.injectableName);
                    self.testTasks.push(baseTaskEmpty.injectableName);
                    helper.handleError(e);
                })
                .then(function() {
                    self.testGraphs.push(graphDefinitionOptions.injectableName);
                    self.testTasks.push(baseTaskEmpty.injectableName);
                    var graphFactory = registry.fetchGraphSync('Graph.testGraphOptions');
                    var graph = graphFactory.create();

                    // If options will be filled in by the graph, make sure validate
                    // doesn't throw if they are missing from the task definition.
                    expect(function() {
                        graph.validate();
                    }).to.not.throw(Error);

                    graph._populateTaskData();

                    _.forEach(graph.tasks, function(task) {
                        if (task.definition.options.testName === 'firstTask') {
                            firstTask = task;
                        } else if (task.definition.options.testName === 'secondTask') {
                            secondTask = task;
                        } else if (task.definition.options.testName === 'thirdTask') {
                            thirdTask = task;
                        } else {
                            fourthTask = task;
                        }
                    });
                })
                .catch(function(e) {
                    helper.handleError(e);
                });
            });

            it("should have tasks with expected keys", function() {
                _.forEach([firstTask, secondTask, thirdTask, fourthTask], function(task) {
                    expect(task).to.have.property('definition');
                    expect(task).to.have.property('options');
                });
            });

            it("should pass default options only to tasks that require those options", function() {
                expect(firstTask.options).to.have.property('option1').that.equals('same for all');
                expect(firstTask.options).to.have.property('option2').that.equals('same for all');
                expect(firstTask.options).to.have.property('option3').that.equals(3);
                expect(firstTask.options).to.not.have.property('optionNonExistant');
            });

            it("should pass task-specific options and override existing options", function() {
                expect(secondTask.options).to.have.property('option1').that.equals('same for all');
                expect(secondTask.options).to.have.property('option2')
                    .that.equals('overridden default option for test-2');
                expect(secondTask.options).to.have.property('option3').that.equals(3);
                expect(secondTask.options).to.have.property('overrideOption')
                    .that.equals('overridden for test-2');
                expect(secondTask.options).to.not.have.property('optionNonExistant');
            });

            it("should pass options to inline tasks definitions", function() {
                // These aren't in the inline definition, so this asserts that we didn't error
                // out on them being missing from options during the requiredOptions check
                expect(thirdTask.options).to.have.property('option1').that.equals('same for all');
                expect(thirdTask.options).to.have.property('option2').that.equals('same for all');
                // Assert that inline task definitions also work with graph options
                expect(thirdTask.options).to.have.property('option3').that.equals(3);
                expect(thirdTask.options).to.have.property('inlineOptionOverridden')
                    .that.equals('overridden inline option for test-3');
                expect(thirdTask.options).to.not.have.property('optionNonExistant');
            });

            it("should pass in options to a task with no required options", function() {
                expect(fourthTask.options).to.have.property('nonRequiredOption')
                    .that.equals('add an option to an empty base task');
            });
        });
    });

    it("should load a task graph data file", function() {
        var graph = TaskGraph.create(graphDefinition);

        expect(graph.definition.injectableName).to.equal(graphDefinition.injectableName);
        expect(graph.definition.tasks).to.deep.equal(graphDefinition.tasks);
    });

    it("should find ready tasks", function() {
        var graphFactory = registry.fetchGraphSync('Graph.test');
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
        this.timeout(10000);
        var graphFactory = registry.fetchGraphSync('Graph.test');
        var graph = graphFactory.create();

        graph.on(graph.completeEventString, function() {
            done();
        });

        graph.start();
    });

    it("should return the graph record on start()", function() {
        var graphFactory = registry.fetchGraphSync('Graph.test');
        var graph = graphFactory.create();

        return graph.start()
        .then(function(graph) {
            expect(graph).to.have.property('instanceId').that.equals(graph.instanceId);
        });
    });

    it("should publish an event on start", function() {
        var graphFactory = registry.fetchGraphSync('Graph.test');
        var graph = graphFactory.create();
        var eventsProtocol = helper.injector.get('Protocol.Events');
        var publishGraphStarted = this.sandbox.stub(eventsProtocol, 'publishGraphStarted');

        return graph.start()
        .then(function() {
            expect(publishGraphStarted).to.have.been.calledWith(graph.instanceId);
        });
    });

    it("should publish an event on finish", function(done) {
        var graphFactory = registry.fetchGraphSync('Graph.test');
        var graph = graphFactory.create();
        var eventsProtocol = helper.injector.get('Protocol.Events');
        var publishGraphFinished = this.sandbox.stub(eventsProtocol, 'publishGraphFinished');

        graph.on(graph.completeEventString, function() {
            try {
                expect(publishGraphFinished).to.have.been.calledWith(graph.instanceId);
                done();
            } catch (e) {
                done(e);
            }
        });

        graph.start();
    });

    it("should change status to succeeded on success", function(done) {
        this.timeout(10000);
        var graphFactory = registry.fetchGraphSync('Graph.test');
        var graph = graphFactory.create();

        graph.on(graph.completeEventString, function() {
            try {
                expect(graph._status).to.equal('succeeded');
                done();
            } catch (e) {
                done(e);
            }
        });

        graph.start();
    });

    it("should serialize to a JSON object", function() {
        var graphFactory = registry.fetchGraphSync('Graph.test');
        var graph = graphFactory.create();
        graph._populateTaskData();

        literalCompare(graph, graph.serialize());
    });

    it("should serialize a graph with a target as a linked node", function() {
        var graphFactory = registry.fetchGraphSync('Graph.test');
        var graph = graphFactory.create({}, { target: '1234' });
        graph._populateTaskData();

        var output = graph.serialize();
        expect(output).to.have.property('node').with.property('id').that.equals('1234');
    });

    it("should serialize a graph with a nodeId option as a linked node", function() {
        var graphFactory = registry.fetchGraphSync('Graph.test');
        var graph = graphFactory.create({ nodeId: '4321' }, {});
        graph._populateTaskData();

        var output = graph.serialize();
        expect(output).to.have.property('node').with.property('id').that.equals('4321');
    });

    it("should serialize to a JSON string", function() {
        var graphFactory = registry.fetchGraphSync('Graph.test');
        var graph = graphFactory.create();
        graph._populateTaskData();

        var json = JSON.stringify(graph);
        expect(function() {
            JSON.parse(json);
        }).to.not.throw(Error);
        var parsed = JSON.parse(json);

        deserializeJson(parsed);

        // Do a recursive compare down to non-object values, since lodash and
        // chai deep equality checks do constructor comparisons, which we don't
        // want in this case.
        literalCompare(graph, parsed);
    });

    it("should create a database record for a graph object", function() {
        var waterline = helper.injector.get('Services.Waterline');

        var graphFactory = registry.fetchGraphSync('Graph.test');
        var graph = graphFactory.create();
        graph._populateTaskData();

        var serialized = graph.serialize();

        expect(waterline.graphobjects).to.be.ok;
        expect(waterline.graphobjects.create).to.be.a.function;
        return waterline.graphobjects.create(serialized);
    });

    describe("Graph Definition Persistence", function() {
        var waterline;
        var testCreateGraphDefinition = {
            friendlyName: 'Test Create Graph',
            injectableName: 'Graph.TestCreate',
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
            waterline = helper.injector.get('Services.Waterline');
        });

        after(function() {
            return waterline.graphdefinitions.destroy({
                injectableName: "Graph.TestCreate"
            });
        });

        it("should create a database record for a graph definition", function() {
            expect(waterline.graphdefinitions).to.be.ok;
            expect(waterline.graphdefinitions.create).to.be.a('function');
            return waterline.graphdefinitions.create(testCreateGraphDefinition);
        });
    });

    // The first persist() will do a create, test that
    it("should have correct JSON after first persist in database records for " +
            "serialized graph objects", function() {
        var waterline = helper.injector.get('Services.Waterline');

        var graphFactory = registry.fetchGraphSync('Graph.test');
        var graph = graphFactory.create();
        graph._populateTaskData();

        var serialized = graph.serialize();

        return graph.persist()
        .then(function() {
            return waterline.graphobjects.findOne({ instanceId: serialized.instanceId });
        })
        .then(function(record) {
            literalCompare(record.deserialize(), serialized);
        });
    });

    // Subsequent persist() calls will do an update, test that
    it("should have correct JSON after subsequent persists in database records " +
            "for serialized graph objects", function() {
        var waterline = helper.injector.get('Services.Waterline');

        var graphFactory = registry.fetchGraphSync('Graph.test');
        var graph = graphFactory.create();
        graph._populateTaskData();

        var serialized = graph.serialize();

        return graph.persist()
        .then(function() {
            return waterline.graphobjects.findOne({ instanceId: serialized.instanceId });
        })
        .then(function(record) {
            literalCompare(record.deserialize(), serialized);
        })
        .then(function() {
            graph.testattribute = 'test';
            return graph.persist();
        })
        .then(function() {
            return waterline.graphobjects.findOne({ instanceId: serialized.instanceId });
        })
        .then(function(record) {
            expect(graph.serialize()).to.have.property('testattribute').that.equals('test');
            expect(record.deserialize()).to.have.property('testattribute').that.equals('test');
            literalCompare(record.deserialize(), graph.serialize());
        });
    });
});
