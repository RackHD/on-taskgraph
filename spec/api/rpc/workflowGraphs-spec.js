// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved
/* jshint node:true */

'use strict';

describe('Taskgraph.Api.Workflows.Rpc', function () {
    var graphsApi;
    var mockery;

    before('setup mockery', function () {
        this.timeout(5000);
        var _ = require('lodash');
        var workflowGraphMethods = [
            'getGraphDefinitions',
            'workflowsGetGraphsByName',
            'defineTaskGraph',
            'destroyGraphDefinition'
        ];

        var injectables = [
            helper.di.simpleWrapper({
                controller: function(opts, cb) {
                    if (typeof(opts) === 'function') {
                        cb = opts;
                    }
                    return cb;
                }
            }, 'Http.Services.Swagger'),
            helper.di.simpleWrapper(
                _.reduce(workflowGraphMethods, function(obj, method) {
                        obj[method] = sinon.stub();
                        return obj;
                    }, {}
                ),
                'Http.Services.Api.Workflows'
            )
        ];

        helper.setupInjector(injectables);

        // setup mockery such that index.injector is our test injector.
        mockery = require('mockery');
        mockery.registerMock('../../index.js', { injector: helper.injector });
        mockery.enable();

        // Now require file to test
        graphsApi = require('../../../api/rpc/workflowGraphs');
    });

    after('disable mockery', function () {
        mockery.deregisterMock('../../index.js');
        mockery.disable();
    });

    describe('GET /workflows/graphs/', function () {
        it("should get all graphs", function() {
            var graphsApiService = helper.injector.get('Http.Services.Api.Workflows');
            graphsApiService.getGraphDefinitions.resolves(['graph1', 'graph2']);
            return graphsApi.workflowsGetGraphs()
            .should.eventually.deep.equal([ 'graph1', 'graph2' ]);
        });

        it("should reject if getGraphDefinitions rejects", function() {
            var graphsApiService = helper.injector.get('Http.Services.Api.Workflows');
            graphsApiService.getGraphDefinitions.rejects('bad graph');
            return graphsApi.workflowsGetGraphs().should.be.rejectedWith('bad graph');
        });
    });

    describe('GET /workflows/graphs/name', function () {
        it("should get graph by name", function() {
            var graphsApiService = helper.injector.get('Http.Services.Api.Workflows');
            graphsApiService.getGraphDefinitions.resolves('graph1');
            return graphsApi.workflowsGetGraphsByName({request: { injectableName: 'graph' } } )
                .should.eventually.equal('graph1');
        });

        it("should reject if getGraphDefinitions rejects", function() {
            var graphsApiService = helper.injector.get('Http.Services.Api.Workflows');
            graphsApiService.getGraphDefinitions.rejects('bad graph');
            return graphsApi.workflowsGetGraphsByName({ request: { injectableName: 'graph' } })
                .should.be.rejectedWith('bad graph');
        });

        it("should reject if req is invalid", function() {
            var graphsApiService = helper.injector.get('Http.Services.Api.Workflows');
            graphsApiService.getGraphDefinitions.resolves();
            return graphsApi.workflowsGetGraphsByName(undefined)
                .should.be.rejectedWith(/undefined/);
        });
    });

    describe('PUT /workflows/graphs/', function () {
        it("should put graph", function() {
            var graphsApiService = helper.injector.get('Http.Services.Api.Workflows');
            graphsApiService.defineTaskGraph.resolves('graph1');
            return graphsApi.workflowsPutGraphs({ request: { body: '{ "foo": "bar" }' } })
                .should.eventually.equal('graph1');
        });

        it("should reject if defineTaskGraph rejects", function() {
            var graphsApiService = helper.injector.get('Http.Services.Api.Workflows');
            graphsApiService.defineTaskGraph.rejects('put failed');
            return graphsApi.workflowsPutGraphs({ request: { body: '{ "foo": "bar" }' } })
                .should.be.rejectedWith('put failed');
        });

        it("should reject if req is invalid", function() {
            var graphsApiService = helper.injector.get('Http.Services.Api.Workflows');
            graphsApiService.defineTaskGraph.rejects('put failed');
            return graphsApi.workflowsPutGraphs(undefined)
                .should.be.rejectedWith(/undefined/);
        });
    });
});
