// Copyright 2014, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

require('../helper');
var _ = require('lodash');


describe(require('path').basename(__filename), function () {
    describe('definition loading', function() {
        beforeEach("before registry-spec", function() {
            this.injector = helper.baseInjector.createChild(
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
            this.loader = this.injector.get('TaskGraph.DataLoader');
            this.registry = this.injector.get('TaskGraph.Registry');

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
            this.registry.fetchGraphDefinitionCatalog = sinon.promise().resolves(
                    _.cloneDeep(this.graphCatalog));
            this.registry.fetchTaskDefinitionCatalog = sinon.promise().resolves(
                    _.cloneDeep(this.taskCatalog));
        });

        it('should load tasks and graphs on start', function() {
            var self = this;
            self.loader.loadGraphs = sinon.promise().resolves(self.graphCatalog);
            self.loader.loadTasks = sinon.promise().resolves(self.taskCatalog);
            self.loader.graphData = _.cloneDeep(self.graphCatalog);
            self.loader.taskData = _.cloneDeep(self.taskCatalog);

            return self.loader.start()
            .then(function() {
                expect(self.loader.loadGraphs.calledWith(self.graphCatalog)).to.equal(true);
                expect(self.loader.loadTasks.calledWith(self.taskCatalog)).to.equal(true);
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
            self.registry.fetchTaskDefinitionCatalog =
                sinon.promise().resolves(updatedRegistryTaskCatalog);
            self.loader.taskData = _.cloneDeep(updatedTaskCatalog);

            self.loader.loadTasks = sinon.promise().resolves([]);

            self.loader.graphData = _.cloneDeep(self.graphCatalog);
            self.loader.loadGraphs = sinon.promise().resolves(self.graphCatalog);

            var expectedResults = self.taskCatalog;
            expectedResults.push(powerOffTask);
            expectedResults.push(pxeTask);

            return self.loader.start()
            .then(function() {
                expect(self.loader.loadTasks.calledWith(expectedResults)).to.equal(true);
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
            self.registry.fetchGraphDefinitionCatalog =
                sinon.promise().resolves(updatedRegistryGraphCatalog);
            self.loader.graphData = _.cloneDeep(updatedGraphCatalog);

            self.loader.loadGraphs = sinon.promise().resolves([]);

            self.loader.taskData = _.cloneDeep(self.taskCatalog);
            self.loader.loadTasks = sinon.promise().resolves(self.taskCatalog);

            var expectedResults = self.graphCatalog;
            expectedResults.push(powerOffGraph);
            expectedResults.push(pxeGraph);

            return self.loader.start()
            .then(function() {
                expect(self.loader.loadGraphs.calledWith(expectedResults)).to.equal(true);
            });
        });
    });
});
