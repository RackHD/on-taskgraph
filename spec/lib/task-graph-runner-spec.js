// Copyright 2015, EMC, Inc.
/* jshint node:true */

'use strict';

describe('TaskGraph.Runner', function () {
    var di = require('di');
    var core = require('on-core')(di, __dirname);
    var servicesCore;
    var TaskScheduler;
    var TaskRunner;
    var LeaseExpirationPoller;
    var taskMessenger;
    var loader;
    var CompletedTaskPoller;
    var serviceGraph;
    var store;
    var taskGraphRunner;
    var sandbox;
    var waterline;

    function mockConsul() {
        return {
            agent: {
                service: {
                    list: sinon.stub().resolves({}),
                    register: sinon.stub().resolves({}),
                    deregister: sinon.stub().resolves({})
                }
            }
        };
    }

    before('setup depedencies', function() {
        var injectables = [
            helper.requireGlob('/lib/*.js'),
            helper.requireGlob('/lib/services/*.js'),
            helper.require('/api/rpc/index.js'),
            helper.di.simpleWrapper(mockConsul, 'consul'),
            require('on-tasks').injectables,
            core.workflowInjectables
        ];
        helper.setupInjector(injectables);
        servicesCore = helper.injector.get('Services.Core');
        TaskScheduler = helper.injector.get('TaskGraph.TaskScheduler');
        TaskRunner = helper.injector.get('TaskGraph.TaskRunner');
        LeaseExpirationPoller = helper.injector.get('TaskGraph.LeaseExpirationPoller');
        taskMessenger = helper.injector.get('Task.Messenger');
        loader = helper.injector.get('TaskGraph.DataLoader');
        CompletedTaskPoller = helper.injector.get('TaskGraph.CompletedTaskPoller');
        serviceGraph = helper.injector.get('TaskGraph.ServiceGraph');
        store = helper.injector.get('TaskGraph.Store');
        taskGraphRunner = helper.injector.get('TaskGraph.Runner');
        waterline = helper.injector.get('Services.Waterline');
        waterline.profiles = {
            destroy: function() {}
        };
        waterline.templates = {
            destroy: function() {}
        };
    });

    beforeEach('setup mocks', function() {
        sandbox = sinon.sandbox.create();
        sandbox.stub(servicesCore, 'start').resolves();
        sandbox.stub(servicesCore, 'stop').resolves();
        sandbox.stub(loader, 'load').resolves();
        sandbox.stub(taskMessenger, 'start').resolves();
        sandbox.stub(TaskRunner, 'create').resolves();
        sandbox.stub(TaskScheduler, 'create').resolves();
        sandbox.stub(CompletedTaskPoller, 'create').resolves();
        sandbox.stub(serviceGraph, 'start').resolves();
        sandbox.stub(waterline.profiles, 'destroy').resolves();
        sandbox.stub(waterline.templates, 'destroy').resolves();
    });

    afterEach('teardown mocks', function() {
        sandbox.restore();
    });

    describe('start method tests', function() {
        var runnerStartStub;
        var schedulerStartStub;
        var completedTaskPollerStartStub;

        beforeEach('setup create methods', function() {
            runnerStartStub = sinon.stub();
            schedulerStartStub = sinon.stub();
            completedTaskPollerStartStub = sinon.stub();
            TaskRunner.create.returns({start: runnerStartStub});
            TaskScheduler.create.returns({start: schedulerStartStub});
            CompletedTaskPoller.create.returns({start: completedTaskPollerStartStub});
        });

        it('should start both a scheduler and a runner', function() {
            return taskGraphRunner.start({
                runner: true,
                scheduler: true,
                domain: 'default'
            }).then(function() {
                expect(runnerStartStub).to.be.called.once;
                expect(schedulerStartStub).to.be.called.once;
                expect(completedTaskPollerStartStub).to.be.called.once;
                expect(serviceGraph.start).to.be.called.once;
            });
        });

        it('should start only a scheduler', function() {
            return taskGraphRunner.start({
                runner: false,
                scheduler: true,
                domain: 'default'
            }).then(function() {
                expect(runnerStartStub).not.to.be.called;
                expect(schedulerStartStub).to.be.called.once;
                expect(completedTaskPollerStartStub).to.be.called.once;
                expect(serviceGraph.start).to.be.called.once;
            });
        });

        it('should start only a runner', function() {
            return taskGraphRunner.start({
                runner: true,
                scheduler: false,
                domain: 'default'
            }).then(function() {
                expect(runnerStartStub).to.be.called.once;
                expect(schedulerStartStub).not.to.be.called;
                expect(completedTaskPollerStartStub).not.to.be.called;
                expect(serviceGraph.start).to.be.called.once;
            });
        });
    });

    describe('stop method tests', function() {
        var runnerStopStub;
        var schedulerStopStub;
        var completedTaskPollerStopStub;

        beforeEach('setup create methods', function() {
            runnerStopStub = sinon.stub();
            schedulerStopStub = sinon.stub();
            completedTaskPollerStopStub = sinon.stub();
            TaskRunner.create.returns({start: sinon.stub(), stop: runnerStopStub});
            TaskScheduler.create.returns({start: sinon.stub(), stop: schedulerStopStub});
            CompletedTaskPoller.create.returns({start: sinon.stub(),
                                                stop: completedTaskPollerStopStub});
        });

        it('should stop both a scheduler and a runner', function() {
            return taskGraphRunner.start({
                runner: true,
                scheduler: true,
                domain: 'default'
            }).then(function() {
                return taskGraphRunner.stop();
            }).then(function() {
                expect(runnerStopStub).to.be.called.once;
                expect(schedulerStopStub).to.be.called.once;
                expect(completedTaskPollerStopStub).to.be.called.once;
                expect(servicesCore.stop).to.be.called.once;
            });
        });

        it('should stop only a scheduler', function() {
            return taskGraphRunner.start({
                runner: false,
                scheduler: true,
                domain: 'default'
            }).then(function() {
                return taskGraphRunner.stop();
            }).then(function() {
                expect(runnerStopStub).not.to.be.called;
                expect(schedulerStopStub).to.be.called.once;
                expect(completedTaskPollerStopStub).to.be.called.once;
                expect(servicesCore.stop).to.be.called.once;
            });
        });

        it('should stop only a runner', function() {
            return taskGraphRunner.start({
                runner: true,
                scheduler: false,
                domain: 'default'
            }).then(function() {
                return taskGraphRunner.stop();
            }).then(function() {
                expect(runnerStopStub).to.be.called.once;
                expect(schedulerStopStub).not.to.be.called;
                expect(completedTaskPollerStopStub).not.to.be.called;
                expect(servicesCore.stop).to.be.called.once;
            });
        });
    });
});
