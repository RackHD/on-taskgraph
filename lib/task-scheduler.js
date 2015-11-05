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
        'Rx'
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
    Rx
) {
    var logger = Logger.initialize(taskSchedulerFactory);
    logger;

    function TaskScheduler(schedulerId) {
        this.schedulerId = schedulerId || uuid.v4();
        this.evaluateGraphStream = new Rx.Subject();
        this.startGraphStream = new Rx.Subject();
        this.pipeline = null;
    }

    TaskScheduler.prototype.initializePipeline = function() {
        var self = this;
        var readyTaskStream = self.evaluateGraphStream
                .flatMap(store.findReadyTasksForGraph.bind(store));

        var graphDoneSubscription = readyTaskStream
                .filter(function(data) { return _.isEmpty(data.tasks); })
                .map(function(data) { return data.graphId; })
                .subscribe(self.checkGraphDone.bind(self));

        var tasksToScheduleSubscription = readyTaskStream
                .filter(function(data) { return !_.isEmpty(data.tasks); })
                .map(function(data) { return data.tasks; })
                .flatMap(Rx.Observable.from)
                .flatMap(store.checkoutTaskForScheduler.bind(store, self.schedulerId))
                .filter(function(task) {
                    // Don't schedule items we couldn't check out
                    return !_.isEmpty(task);
                })
                .subscribe(self.scheduleTaskHandler.bind(self));

        var startTaskGraphSubscription = self.startGraphStream
                // TODO: this map() is for test, remove
                .map(function() {
                    return { definition: {
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
                                    'noop-1': 'finished',
                                    'noop-2': 'finished or timeout'
                                }
                            },
                            {
                                label: 'parallel-noop-2',
                                taskName: 'Task.noop',
                                waitOn: {
                                    'noop-1': 'finished',
                                    'noop-2': 'finished or timeout'
                                }
                            },
                        ]
                    }};
                })
                //
                .flatMap(TaskGraph.create)
                .flatMap(self.persistInitialGraphAndTaskState.bind(self))
                // TODO: is this bind necessary??
                .subscribe(
                    self.evaluateGraphStream.onNext.bind(self.evaluateGraphStream),
                    function(err) {
                        logger.error('Error starting task graph', {
                            error: err
                        }
                    );
                });

        return [
            tasksToScheduleSubscription,
            startTaskGraphSubscription,
            graphDoneSubscription
        ];
    };

    TaskScheduler.prototype.checkGraphDone = function(graphId) {
        // TODO: do this?
        // store.updateUnreachableTasksForGraph(graphId)
        return store.checkGraphDone(graphId)
        .then(function(result) {
            if (result) {
                // TODO: mark graph state as done here in the db?
                // TODO: use Rx, abstract the messenger strategy away to another module.
                return eventsProtocol.publishGraphFinished(result.instanceId, result._status);
            }
        })
        .catch(function(error) {
            logger.error('Error checking if graph is finished', {
                graphId: graphId,
                error: error
            });
        });
    };

    TaskScheduler.prototype.scheduleTaskHandler = function(task) {
        // TODO: Add more scheduling logic here when necessary
        logger.debug('Schedule task handler called ' + task.instanceId);
    };

    TaskScheduler.prototype.persistInitialGraphAndTaskState = function(graph) {
        return Promise.all([
            store.persistGraphObject(graph),
            Promise.map(graph.createTaskDependencyItems(), function(item) {
                return store.persistTaskDependencies(item, graph.instanceId);
            })
        ])
        .then(function() {
            return graph.instanceId;
        });
    };

    TaskScheduler.prototype.start = function() {
        this.pipelines = this.initializePipeline();

        // TODO: remove test
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
