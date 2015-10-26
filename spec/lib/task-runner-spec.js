// Copyright 2015, EMC, Inc.
/* jshint node:true */

'use strict';

describe("Task-runner", function() {
    var runner,
    Task = {},
    TaskRunner,
    store = {},
    taskAndGraphId,
    stubbedTask = {run:function() {}},
    taskDef = {
        friendlyName: 'testTask',
        implementsTask: 'fakeBaseTask',
        runJob: 'fakeJob',
        options: {},
        properties: {}
    };

    before(function() {
        helper.setupInjector([
                require('../../lib/task-runner.js'),
                helper.di.simpleWrapper(Task, 'Task.Task'),
                helper.di.simpleWrapper(store, 'TaskGraph.Store')
        ]);
        TaskRunner = helper.injector.get('TaskGraph.TaskRunner');
        this.sandbox = sinon.sandbox.create();
    });

    beforeEach(function() {
        runner = new TaskRunner();
        taskAndGraphId = {
            taskId: 'someTaskId',
            graphId: 'someGraphId'
        };
        stubbedTask.run = this.sandbox.stub();
        Task.create = this.sandbox.stub().returns(stubbedTask);
        store.checkoutTask = this.sandbox.stub();
        return runner.start();
    });

    afterEach(function() {
        this.sandbox.restore();
    });

    it("should initialize its input stream", function() {
        expect(runner.pipeline).to.not.equal(null);
    });

    it("should instantiate and run checked out task", function(done) {
        store.checkoutTask.resolves(taskDef);
        runner.inputStream.onNext(taskAndGraphId);

        setImmediate(function() {
            expect(Task.create).to.have.been.calledOnce;
            expect(stubbedTask.run).to.have.been.calledOnce;
            done();
        });
    });

    it("should filter tasks that have already been checkout out", function(done) {
        store.checkoutTask.onCall(0).resolves(taskDef);
        store.checkoutTask.onCall(1).resolves(undefined);

        runner.inputStream.onNext(taskAndGraphId);
        runner.inputStream.onNext(taskAndGraphId);

        setImmediate(function() {
            expect(store.checkoutTask).to.be.calledTwice;
            expect(stubbedTask.run).to.be.calledOnce;
            done();
        });

    });

    it("should listen for task/graph IDs to run", function() {

    });

    it("should dispose all stream resources on stop", function() {
        this.sandbox.spy(runner.inputStream, 'dispose');
        runner.stop();
        expect(runner.inputStream.dispose).to.have.been.calledOnce;
    });

});
