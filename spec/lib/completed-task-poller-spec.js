// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe("Task-runner", function() {
    var Poller,
        poller,
        store = { deleteTasks: sinon.stub().resolves() },
        Rx;

    var subscribeWrapper = function(done, cb) {
        return function(data) {
            try {
                cb(data);
                done();
            } catch (e) {
                done(e);
            }
        };
    };

    before(function() {
        helper.setupInjector([
            helper.require('/lib/completed-task-poller.js'),
            helper.di.simpleWrapper(store, 'TaskGraph.Store')
        ]);
        Rx = helper.injector.get('Rx');
        //Promise = helper.injector.get('Promise');
        Poller = helper.injector.get('TaskGraph.CompletedTaskPoller');
        this.sandbox = sinon.sandbox.create();

        sinon.stub.onNext = function(data) {
            this.returns(Rx.Observable.just(data));
        };
    });

    beforeEach(function() {
        poller = Poller.create('test', {});
    });

    afterEach(function() {
        this.sandbox.restore();
    });

    describe('deleteCompletedGraphs', function() {
        beforeEach(function() {
            this.sandbox.stub(poller, 'handlePotentialFinishedGraph').onNext();
        });

        it('should take only graphIds from last tasks', function(done) {
            var graphId1 = 'graphId1';
            var graphId2 = 'graphId2';
            var graphId3 = 'graphId3';
            var tasks = [
                { taskId: 'taskId1', terminal: true, graphId: graphId1 },
                { taskId: 'taskId2', terminal: false, graphId: graphId2 },
                { taskId: 'taskId2', terminal: true, graphId: graphId3 },
            ];

            return poller.deleteCompletedGraphs(tasks)
            .subscribe(subscribeWrapper(done, function() {
                expect(poller.handlePotentialFinishedGraph).to.have.been.calledTwice;
                expect(poller.handlePotentialFinishedGraph).to.have.been.calledWith(graphId1);
                expect(poller.handlePotentialFinishedGraph).to.have.been.calledWith(graphId3);
            }), done);
        });

        it('should have an output that equals the input', function(done) {
            var tasks = [
                { taskId: 'taskId1', terminal: true, graphId: 'graphId1' },
                { taskId: 'taskId2', terminal: false, graphId: 'graphId2' }
            ];

            return poller.deleteCompletedGraphs(tasks)
            .subscribe(subscribeWrapper(done, function(out) {
                expect(out).to.equal(tasks);
            }), done);
        });
    });

    describe('deleteTasks', function() {
        it('should have an output that equals the input', function(done) {
            var tasks = [
                { taskId: 'taskId1', graphId: 'graphId1' },
                { taskId: 'taskId2', graphId: 'graphId2' },
                { taskId: 'taskId3', graphId: 'graphId3' }
            ];
            var expected = _(tasks).map('taskId').value();

            return poller.deleteTasks(tasks)
            .subscribe(subscribeWrapper(done, function() {
                expect(store.deleteTasks).to.have.been.calledOnce;
                expect(store.deleteTasks).to.have.been.calledWith(expected);
            }),
            done);
        });
    });
});
