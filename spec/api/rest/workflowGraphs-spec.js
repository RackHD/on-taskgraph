// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Workflows.2.0', function () {
    var workflowApiService;
    var arpCache = {
        getCurrent: sinon.stub().resolves([])
    };

    before('start HTTP server', function () {
        this.timeout(5000);
        workflowApiService = {
            getGraphDefinitions: sinon.stub(),
            workflowsGetGraphsByName: sinon.stub(),
            defineTaskGraph: sinon.stub(),
            destroyGraphDefinition: sinon.stub()
        };

        return helper.startServer([
            dihelper.simpleWrapper(workflowApiService, 'Http.Services.Api.Workflows'),
            dihelper.simpleWrapper(arpCache, 'ARPCache')
        ]);
    });

    afterEach('set up mocks', function () {
        workflowApiService.getGraphDefinitions.reset();
        workflowApiService.workflowsGetGraphsByName.reset();
        workflowApiService.defineTaskGraph.reset();
        workflowApiService.destroyGraphDefinition.reset();
    });

    after('stop HTTP server', function () {
        return helper.stopServer();
    });

    describe('workflowsGetGraphs', function () {
        it('should retrieve the workflow Graphs', function () {
            var graph = {
                "friendlyName": "Dummy Pollers",
                "injectableName": "Dummy.Poller.Create",
                "tasks": [
                    {
                        "label": "create-redfish-pollers",
                        "taskName": "Task.Pollers.CreateDefault"
                    }
                ]
            };

            workflowApiService.getGraphDefinitions.resolves([graph]);

            return helper.request().get('/api/2.0/workflows/graphs')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function(res){
                    expect(res.body[0])
                        .to.have.property('tasks')
                        .to.deep.equal([{"label": "create-redfish-pollers", "taskName": "/api/2.0/workflows/tasks/Task.Pollers.CreateDefault"}]);

                    expect(res.body[0])
                        .to.have.property('friendlyName').that.equals('Dummy Pollers');

                    expect(res.body[0])
                        .to.have.property('injectableName').that.equals('Dummy.Poller.Create');
                });
        });

        it('should retrieve the workflow Graphs with inline task', function () {
            var graph ={
                "friendlyName": "Dummy Pollers",
                "injectableName": "Dummy.Poller.Create",
                "tasks": [
                    {
                        "label": "boot-graph",
			"taskDefinition": {
			"friendlyName": "Boot Graph",
			"injectableName": "Task.Graph.Run.Boot",
			"implementsTask": "Task.Base.Graph.Run",
			"options": {
			    "graphName": "Graph.BootstrapUbuntu",
			    "defaults": {
			        "graphOptions": {}
			        }
			    },
                        "properties": {}
                        }
                  }
                ]
            };
            var task = {
                "friendlyName": "Boot Graph",
                "injectableName": "Task.Graph.Run.Boot",
                "implementsTask": "Task.Base.Graph.Run",
                "options": {
                    "graphName": "Graph.BootstrapUbuntu",
                    "defaults": {
                    "graphOptions": {}
                    }
                },
                "properties": {}
            };

            workflowApiService.getGraphDefinitions.resolves([graph]);

            return helper.request().get('/api/2.0/workflows/graphs')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function(res){
                    expect(res.body[0])
                        .to.have.property('tasks')
                        .to.deep.equal([{"label": "boot-graph", "taskDefinition": task } ]);
                    expect(res.body[0])
                        .to.have.property('friendlyName').that.equals('Dummy Pollers');

                    expect(res.body[0])
                        .to.have.property('injectableName').that.equals('Dummy.Poller.Create');
                });


        });
    });

    describe('workflowsGetGraphsByName', function () {
        it('should retrieve the graph by Name', function () {
            var graph =
            {
                "friendlyName": "Dummy Pollers",
                "injectableName": "Dummy.Poller.Create",
                "tasks": [
                    {
                        "label": "create-redfish-pollers",
                        "taskName": "Task.Pollers.CreateDefault"
                    }
                ]
            };

            workflowApiService.getGraphDefinitions.resolves(graph);

            return helper.request().get('/api/2.0/workflows/graphs/' + graph.injectableName)
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function() {
                    expect(workflowApiService.getGraphDefinitions).to.have.been.calledOnce;
                    expect(workflowApiService.getGraphDefinitions)
                        .to.have.been.calledWith('Dummy.Poller.Create');
                });
        });

    });

   describe('workflowsPutGraphs', function () {
        it('should persist a graph', function () {
            var graph =
            {
                "friendlyName": "Dummy Pollers",
                "injectableName": "Dummy.Poller.Create",
                "tasks": [
                    {
                        "label": "create-redfish-pollers",
                        "taskName": "Task.Pollers.CreateDefault"
                    }
                ]
            };
            workflowApiService.defineTaskGraph.resolves(graph);

            return helper.request().put('/api/2.0/workflows/graphs')
            .send(graph)
            .expect('Content-Type', /^application\/json/)
            .expect(201, graph);
        });
    });

   describe('workflowsDeleteGraphsByName', function () {
        it('should delete Graph by name', function () {
            var graph =
            {
                "injectableName": "Graph.Example.RackHD",
                "friendlyName": "Test.Graph",
                "tasks": [
                    {
                        "label": "noop-1",
                        "taskName": "Task.noop"
                    }
                ]
            };
            workflowApiService.destroyGraphDefinition.resolves(graph);

            return helper.request().delete('/api/2.0/workflows/graphs/' + graph.injectableName)
            .expect(204)
            .expect(function() {
                expect(workflowApiService.destroyGraphDefinition).to.have.been.calledOnce;
                expect(workflowApiService.destroyGraphDefinition)
                    .to.have.been.calledWith('Graph.Example.RackHD');
            });
        });
    });
});

