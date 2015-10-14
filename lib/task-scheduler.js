// Copyright 2015, EMC, Inc.

'use strict';

var di = require('di');

module.exports = taskSchedulerFactory;
di.annotate(taskSchedulerFactory, new di.Provide('TaskGraph.TaskScheduler'));
di.annotate(taskSchedulerFactory,
    new di.Inject(
        'Protocol.Events',
        'TaskGraph.TaskGraph',
        'TaskGraph.Store',
        'Logger',
        'Promise',
        'uuid',
        '_',
        'Rx',
        di.Injector
    )
);

function taskSchedulerFactory(
    eventsProtocol,
    TaskGraph,
    store,
    Logger,
    Promise,
    uuid,
    _,
    Rx,
    injector
) {
    var logger = Logger.initialize(taskSchedulerFactory);
    logger;

    function TaskScheduler(schedulerId) {
        this.schedulerId = schedulerId || uuid.v4();
        this.evaluteGraphStream = new Rx.Subject();
        this.startGraphStream = new Rx.Subject();
        this.pipeline = null;
    }

    TaskScheduler.prototype.initializePipeline = function() {
        var tasksToSchedule = this.evaluteGraphStream
                // TODO: refactor to clean up, make a prototype helper function
                .flatMap(this.evaluateGraph.bind(this))
                // Convert array of ready tasks to an observable sequence
                .flatMap(Rx.Observable.from)
                .flatMap(store.checkoutTask.bind(store, this.schedulerId))
                .filter(function(task) {
                    // Don't schedule items we couldn't check out
                    return !_.isEmpty(task);
                });

        return [
            tasksToSchedule.subscribe(this.scheduleTaskHandler.bind(this)),
            this.startGraphStream.subscribe(this.handleStartTaskGraphRequest.bind(this))
        ];
    };

    TaskScheduler.prototype.evaluateGraph = function(graphId) {
        return store.checkGraphDone(graphId)
        .then(function(graph) {
            if (graph) {
                return store.findReadyTasksForGraph(graphId);
            } else {
                // TODO: use Rx, abstract the messenger strategy away to
                // another module.
                eventsProtocol.publishGraphFinished(
                    graph.instanceId, graph._status);
                return [];
            }
        });
    };

    TaskScheduler.prototype.scheduleTaskHandler = function(task) {
        // TODO: Add more scheduling logic here when necessary
        logger.debug('Schedule task handler called ' + task.instanceId);
    };

    TaskScheduler.prototype.handleStartTaskGraphRequest = function(name, options, target) {
        var self = this;

        return Promise.resolve()
        .then(function() {
            var definition = {
                friendlyName: 'noop-graph',
                injectableName: 'Graph.noop-example',
                tasks: [
                    {
                        label: 'noop-1',
                        taskName: 'Task.noop'
                    },
                    {
                        label: 'noop-2',
                        taskName: 'Task.noop',
                        waitOn: {
                            'noop-1': 'finished'
                        }
                    },
                    {
                        label: 'parallel-noop-1',
                        taskName: 'Task.noop',
                        waitOn: {
                            'noop-2': 'finished'
                        }
                    },
                    {
                        label: 'parallel-noop-2',
                        taskName: 'Task.noop',
                        waitOn: {
                            'noop-2': 'finished'
                        }
                    },
                ]
            };
            //var definition = injector.get(name);
            return TaskGraph.create(definition, options, target);
        })
        .then(function(graph) {
            var _graph = graph.toJSON();
            return [
                store.persistGraphObject(_graph),
                Promise.map(_.values(_graph.tasks), store.persistDependencies)
            ];
        })
        .spread(function(graph) {
            debugger;
            self.evaluteGraphStream.onNext(graph.instanceId);
            return graph.instanceId;
        })
        .catch(function(error) {
            logger.error('Failure handling start taskgraph request', {
                error: error,
                name: name,
                target: target,
                options: options
            });
            debugger;
        });
    };

    TaskScheduler.prototype.start = function() {
        this.pipelines = this.initializePipeline();

        // test
        this.test();
    };

    TaskScheduler.prototype.test = function() {
        this.startGraphStream.onNext('test');
    };

    TaskScheduler.prototype.stop = function() {
        _.forEach(this.pipelines, function(pipeline) {
            pipeline.dispose();
        });
    };

    TaskScheduler.create = function() {
        return new TaskScheduler();
    };

    return TaskScheduler;
}
