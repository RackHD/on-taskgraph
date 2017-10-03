// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved
'use strict';

var di = require('di');

module.exports = schedulerServerFactory;
di.annotate(schedulerServerFactory, new di.Provide('TaskGraph.TaskScheduler.Server'));
di.annotate(schedulerServerFactory,
    new di.Inject(
        'Assert',
        '_',
        'Promise',
        'Logger'
    )
);

function schedulerServerFactory(
    assert,
    _,
    Promise,
    Logger
) {

    var logger = Logger.initialize(schedulerServerFactory);

    function SchedulerServer(options) {
        this.options = options || {
            hostname: '0.0.0.0'
        };
        this.options.protoFile = this.options.protoFile || __dirname + '/../../scheduler.proto';

        assert.string(this.options.hostname);
        assert.string(this.options.protoFile);
    }

    SchedulerServer.prototype.start = function() {
        var self = this;

        return Promise.try(function() {
            var grpc = require('grpc');
            var schedulerProto = grpc.load(self.options.protoFile).scheduler;

            var templates = require('./templates.js');
            var tasks = require('./tasks.js');
            var workflowGraphs = require('./workflowGraphs.js');
            var workflows = require('./workflows.js');
            var workflowTasks = require('./workflowTasks.js');
            var profiles = require('./profiles.js');


            self.gRPC = new grpc.Server();
            self.gRPC.addProtoService(schedulerProto.Scheduler.service, {
                getBootstrap: grpcWrapper(tasks.getBootstrap),
                getTasksById: grpcWrapper(tasks.getTasksById),
                postTaskById: grpcWrapper(tasks.postTaskById),
                workflowsGetGraphs: grpcWrapper(workflowGraphs.workflowsGetGraphs),
                workflowsGetGraphsByName: grpcWrapper(workflowGraphs.workflowsGetGraphsByName),
                workflowsPutGraphs: grpcWrapper(workflowGraphs.workflowsPutGraphs),
                workflowsDeleteGraphsByName: grpcWrapper(workflowGraphs.workflowsDeleteGraphsByName), // jshint ignore:line
                workflowsGet: grpcWrapper(workflows.workflowsGet),
                workflowsPost: grpcWrapper(workflows.workflowsPost),
                workflowsGetByInstanceId: grpcWrapper(workflows.workflowsGetByInstanceId),
                workflowsDeleteByInstanceId: grpcWrapper(workflows.workflowsDeleteByInstanceId),
                workflowsAction: grpcWrapper(workflows.workflowsAction),
                workflowsPutTask: grpcWrapper(workflowTasks.workflowsPutTask),
                workflowsGetAllTasks: grpcWrapper(workflowTasks.workflowsGetAllTasks),
                workflowsGetTasksByName: grpcWrapper(workflowTasks.workflowsGetTasksByName),
                workflowsDeleteTasksByName: grpcWrapper(workflowTasks.workflowsDeleteTasksByName),
                templatesLibGet: grpcWrapper(templates.templatesLibGet),
                templatesLibPut: grpcWrapper(templates.templatesLibPut),
                templatesMetaGet: grpcWrapper(templates.templatesMetaGet),
                templatesMetaGetByName: grpcWrapper(templates.templatesMetaGetByName),
                templatesLibDelete: grpcWrapper(templates.templatesLibDelete),
                profilesGetLibByName: grpcWrapper(profiles.profilesGetLibByName),
                profilesGetMetadata: grpcWrapper(profiles.profilesGetMetadata),
                profilesGetMetadataByName: grpcWrapper(profiles.profilesGetMetadataByName),
                profilesPostSwitchError: grpcWrapper(profiles.profilesPostSwitchError),
                profilesPutLibByName: grpcWrapper(profiles.profilesPutLibByName)


            });

            self.options.port = self.gRPC.bind(
                self.options.hostname + (self.options.port ? ':' + self.options.port : ''),
                grpc.ServerCredentials.createInsecure());
            self.gRPC.start();
            logger.info('gRPC is available on grpc://' +
                (self.options.port ? self.options.hostname + ':' + self.options.port : self.options.hostname));
        });
    };

    SchedulerServer.prototype.stop = function() {
        var self = this;
        return Promise.try(function() {
            self.gRPC.forceShutdown();
        });
    };

    function grpcWrapper(rpcEntry) {
        return function(call, callback) {
            return Promise.try(function() {
                return rpcEntry(call, callback);
            })
            .then(function(response) {
                if(response) {
                    callback(null, {
                        response: JSON.stringify(response)
                    });
                }
            })
            .catch(function(err) {
                callback(err);
            });
        };
    }

    return SchedulerServer;
}


