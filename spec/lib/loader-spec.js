// Copyright 2016, EMC, Inc.

'use strict';

describe('Loader', function () {
    var di = require('di');
    var core = require('on-core')(di, __dirname);

    var loader,
        store;

    before(function() {
        this.timeout(3000);
        helper.setupInjector([
            core.workflowInjectables,
            require('on-tasks').injectables,
            helper.require('/lib/loader')
        ]);
        loader = helper.injector.get('TaskGraph.DataLoader');
        store = helper.injector.get('TaskGraph.Store');
        this.sandbox = sinon.sandbox.create();
    });

    describe('definition loading', function() {
        beforeEach(function() {
            this.graphCatalog = [
                { injectableName: 'Graph.Reboot.Node',
                  tasks: [ { label: 'reboot', taskName: 'Task.Obm.Node.Reboot' } ],
                  friendlyName: 'Reboot Node' },
                { injectableName: 'Graph.PowerOn.Node',
                  tasks: [ { label: 'reboot', taskName: 'Task.Obm.Node.PowerOn' } ],
                  friendlyName: 'Power On Node' }
            ];
            this.taskCatalog = [
                { injectableName: 'Task.Obm.Node.Reboot',
                  properties: { power: { state: 'reboot' } },
                  friendlyName: 'Reboot Node',
                  implementsTask: 'Task.Base.Obm.Node',
                  options: { action: 'reboot' } },
                { injectableName: 'Task.Obm.Node.PowerOn',
                  properties: { power: {} },
                  friendlyName: 'Power On Node',
                  implementsTask: 'Task.Base.Obm.Node',
                  options: { action: 'powerOn' } },
            ];
            this.sandbox.stub(store, 'getTaskDefinitions').resolves(this.taskCatalog);
            this.sandbox.stub(store, 'getGraphDefinitions').resolves(this.graphCatalog);
            this.sandbox.stub(store, 'persistGraphDefinition').resolves();
            this.sandbox.stub(store, 'persistTaskDefinition').resolves();
        });

        afterEach(function() {
            this.sandbox.restore();
        });

        it('should load tasks and graphs', function() {
            var self = this;
            this.sandbox.spy(loader, 'persistTasks');
            this.sandbox.spy(loader, 'persistGraphs');
            loader.graphData = _.cloneDeep(self.graphCatalog);
            loader.taskData = _.cloneDeep(self.taskCatalog);
            loader.graphLibrary = [];
            loader.taskLibrary = [];

            return loader.load()
            .then(function() {
                expect(loader.persistGraphs.calledWith(self.graphCatalog)).to.equal(true);
                expect(loader.persistTasks.calledWith(self.taskCatalog)).to.equal(true);
            });
        });

        it('should merge disk and database tasks', function() {
            var self = this;
            var powerOffTask = { injectableName: 'Task.Obm.Node.PowerOff',
                                 properties: { power: {} },
                                 friendlyName: 'Power Off Node',
                                 implementsTask: 'Task.Base.Obm.Node',
                                 options: { actiOff: 'powerOff' } };
            var pxeTask = { injectableName: 'Task.Obm.Node.SetBootPxe',
                            properties: {},
                            friendlyName: 'Set Boot Pxe',
                            implementsTask: 'Task.Base.Obm.SetBootPxe',
                            options: { action: 'setBootPxe' } };

            var updatedTaskCatalog = _.cloneDeep(self.taskCatalog);
            updatedTaskCatalog.push(powerOffTask);
            var updatedRegistryTaskCatalog = _.cloneDeep(self.taskCatalog);
            updatedRegistryTaskCatalog.push(pxeTask);

            // Each object has a unique document in them, to test merge with
            store.getTaskDefinitions.resolves(updatedRegistryTaskCatalog);
            loader.taskLibrary = _.cloneDeep(updatedTaskCatalog);
            loader.graphLibrary = _.cloneDeep(self.graphCatalog);
            this.sandbox.spy(loader, 'persistTasks');

            var expectedResults = self.taskCatalog;
            expectedResults.push(powerOffTask);
            expectedResults.push(pxeTask);

            return loader.load()
            .then(function() {
                expect(loader.persistTasks).to.have.been.calledWith(expectedResults);
            });
        });

        it('should merge disk and database graphs on start', function() {
            var self = this;

            var powerOffGraph = { injectableName: 'Graph.PowerOff.Node',
                                  tasks: [
                                    { label: 'poweroff', taskName: 'Task.Obm.Node.PowerOff' } ],
                                  friendlyName: 'Power Off Node' };

            var pxeGraph = { injectableName: 'Graph.SetBootPxe.Node',
                                 tasks: [
                                    { label: 'setBootPxe', taskName: 'Task.Obm.Node.SetBootPxe' } ],
                                 friendlyName: 'Set Pxe Boot Node' };

            var updatedGraphCatalog = _.cloneDeep(self.graphCatalog);
            updatedGraphCatalog.push(powerOffGraph);
            var updatedRegistryGraphCatalog = _.cloneDeep(self.graphCatalog);
            updatedRegistryGraphCatalog.push(pxeGraph);

            // Each object has a unique document in them, to test merge with
            store.getGraphDefinitions.resolves(updatedRegistryGraphCatalog);
            loader.graphLibrary = _.cloneDeep(updatedGraphCatalog);
            loader.taskLibrary = _.cloneDeep(self.taskCatalog);
            this.sandbox.spy(loader, 'persistGraphs');

            var expectedResults = self.graphCatalog;
            expectedResults.push(powerOffGraph);
            expectedResults.push(pxeGraph);

            return loader.load()
            .then(function() {
                expect(loader.persistGraphs).to.have.been.calledWith(expectedResults);
            });
        });
    });
});
