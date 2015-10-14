// Copyright 2015, EMC, Inc.

'use strict';

describe('Task Scheduler', function() {
    var TaskScheduler;
    var taskScheduler;
    var Constants;

    before('before Task Scheduler', function() {
        helper.setupInjector([require('../../lib/task-scheduler')]);
        Constants = helper.injector.get('Constants');
        TaskScheduler = helper.injector.get('TaskGraph.TaskScheduler');
    });

    describe('Scheduling Pipeline', function() {
        beforeEach('beforeEach Scheduling Pipeline', function() {
            taskScheduler = TaskScheduler.create();
            taskScheduler.evaluateGraphStateHandler = sinon.stub();
            taskScheduler.evaluateExternalContextHandler = sinon.stub();
            taskScheduler.scheduleTaskHandler = sinon.stub();
            return taskScheduler.initializePipeline();
        });

        afterEach('afterEach Scheduling Pipeline', function() {
            return taskScheduler.stop();
        });

        it('should respond to graph state change events', function() {
            var graph = {};
            taskScheduler.graphStateChangeStream.onNext(graph);

            expect(taskScheduler.evaluateGraphStateHandler).to.have.been.calledOnce;
            expect(taskScheduler.evaluateGraphStateHandler).to.have.been.calledWith(graph);
        });

        it('should respond to external context update events', function(done) {
            var graph = {};
            taskScheduler.evaluateExternalContextHandler.resolves([]);
            taskScheduler.externalContextStream.onNext(graph);

            setImmediate(function() {
                try {
                    expect(taskScheduler.evaluateExternalContextHandler).to.have.been.calledOnce;
                    expect(taskScheduler.evaluateExternalContextHandler)
                        .to.have.been.calledWith(graph);
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });

        it('should schedule a task on graph state change', function() {
            var tasks = [
                { instanceId: 'test-task-id' }
            ];
            taskScheduler.evaluateGraphStateHandler.returns(tasks);
            taskScheduler.graphStateChangeStream.onNext();

            expect(taskScheduler.scheduleTaskHandler).to.have.been.calledOnce;
            expect(taskScheduler.scheduleTaskHandler).to.have.been.calledWith(tasks);
        });

        it('should schedule a task on external context update', function(done) {
            var tasks = [
                { instanceId: 'test-task-id' }
            ];
            taskScheduler.evaluateExternalContextHandler.resolves(tasks);
            taskScheduler.externalContextStream.onNext({});

            setImmediate(function() {
                try {
                    expect(taskScheduler.scheduleTaskHandler).to.have.been.calledOnce;
                    expect(taskScheduler.scheduleTaskHandler).to.have.been.calledWith(tasks);
                    done();
                } catch (e) {
                    done(e);
                }
            });
        });
    });
});
