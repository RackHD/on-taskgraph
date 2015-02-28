// Copyright 2014, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

describe(require('path').basename(__filename), function () {
    var loader;
    var registry;

    before(function() {
        helper.setupInjector(
            _.flatten([
                helper.require('/lib/task-graph'),
                helper.require('/lib/scheduler'),
                helper.require('/lib/registry'),
                helper.require('/lib/loader'),
                helper.require('/lib/stores/waterline'),
                helper.require('/lib/stores/memory'),
                require('renasar-tasks').injectables
            ])
        );
    });

    describe('definition loading', function() {
        beforeEach("before loader-spec", function() {
            loader = helper.injector.get('TaskGraph.DataLoader');
            registry = helper.injector.get('TaskGraph.Registry');

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
            registry.fetchGraphDefinitionCatalog = sinon.stub().resolves(
                    _.cloneDeep(this.graphCatalog));
            registry.fetchTaskDefinitionCatalog = sinon.stub().resolves(
                    _.cloneDeep(this.taskCatalog));
        });

        it('should load tasks and graphs on start', function() {
            var self = this;
            loader.loadGraphs = sinon.stub().resolves(self.graphCatalog);
            loader.loadTasks = sinon.stub().resolves(self.taskCatalog);
            loader.graphData = _.cloneDeep(self.graphCatalog);
            loader.taskData = _.cloneDeep(self.taskCatalog);

            return loader.start()
            .then(function() {
                expect(loader.loadGraphs.calledWith(self.graphCatalog)).to.equal(true);
                expect(loader.loadTasks.calledWith(self.taskCatalog)).to.equal(true);
            });
        });

        it('should merge disk and database tasks on start', function() {
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
            registry.fetchTaskDefinitionCatalog =
                sinon.stub().resolves(updatedRegistryTaskCatalog);
            loader.taskData = _.cloneDeep(updatedTaskCatalog);

            loader.loadTasks = sinon.stub().resolves([]);

            loader.graphData = _.cloneDeep(self.graphCatalog);
            loader.loadGraphs = sinon.stub().resolves(self.graphCatalog);

            var expectedResults = self.taskCatalog;
            expectedResults.push(powerOffTask);
            expectedResults.push(pxeTask);

            return loader.start()
            .then(function() {
                expect(loader.loadTasks.calledWith(expectedResults)).to.equal(true);
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
            registry.fetchGraphDefinitionCatalog =
                sinon.stub().resolves(updatedRegistryGraphCatalog);
            loader.graphData = _.cloneDeep(updatedGraphCatalog);

            loader.loadGraphs = sinon.stub().resolves([]);

            loader.taskData = _.cloneDeep(self.taskCatalog);
            loader.loadTasks = sinon.stub().resolves(self.taskCatalog);

            var expectedResults = self.graphCatalog;
            expectedResults.push(powerOffGraph);
            expectedResults.push(pxeGraph);

            return loader.start()
            .then(function() {
                expect(loader.loadGraphs.calledWith(expectedResults)).to.equal(true);
            });
        });
    });
});
