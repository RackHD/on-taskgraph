// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.workflowTasks.2.0', function () {
    var waterline;
    var workflowApiService;
    var arpCache = { 
        getCurrent: sinon.stub().resolves([])
    };
    var views;

    before('start HTTP server', function () {
        var self = this;
        this.timeout(5000);

        waterline = {
            start: sinon.stub(),
            stop: sinon.stub(),
            lookups: {
                setIndexes: sinon.stub()
            }
        };
        this.sandbox = sinon.sandbox.create();

        return helper.startServer([
            dihelper.simpleWrapper(waterline, 'Services.Waterline'),
            dihelper.simpleWrapper(arpCache, 'ARPCache')
        ])
        .then(function() {
            workflowApiService = helper.injector.get('Http.Services.Api.Workflows');
            self.sandbox.stub(workflowApiService, 'defineTask').resolves();
            self.sandbox.stub(workflowApiService, 'getTaskDefinitions').resolves();
            self.sandbox.stub(workflowApiService, 'getWorkflowsTasksByName').resolves();
            self.sandbox.stub(workflowApiService, 'deleteWorkflowsTasksByName').resolves();

            views = helper.injector.get('Views');
            self.sandbox.stub(views, 'get').resolves({});
            self.sandbox.stub(views, 'render').resolves('{"friendlyName": "dummy", "injectableName": "dummyName", "options": {"oids": "SNMPv2-MIB::sysDescr"}}');
            self.sandbox.stub(helper.injector.get('ejs'), 'render')
            .resolves('{"friendlyName": "dummy", "injectableName": "dummyName", "options": {"oids": "SNMPv2-MIB::sysDescr"}}');
        });
    });

    beforeEach('set up mocks', function () {
        waterline.nodes = {
            findByIdentifier: sinon.stub().resolves()
        };
        waterline.graphobjects = {
            find: sinon.stub().resolves([]),
            findByIdentifier: sinon.stub().resolves(),
            needByIdentifier: sinon.stub().resolves()
        };
        waterline.lookups = {
            // This method is for lookups only and it
            // doesn't impact behavior whether it is a
            // resolve or a reject since it's related
            // to logging.
            findOneByTerm: sinon.stub().rejects()
        };

    });

    afterEach('clean up mocks', function () {
        this.sandbox.reset();
    });

    after('stop HTTP server', function () {
        this.sandbox.restore();
        return helper.stopServer();
    });

    describe('workflowsPutTask ', function () {
        it('should persist a task', function () {
            var task = {
                friendlyName: 'dummy',
                injectableName: 'dummyName',
                options: {
                    oids: 'SNMPv2-MIB::sysDescr'
                }
            };
            workflowApiService.defineTask.resolves(task);

            return helper.request().put('/api/2.0/workflows/tasks')
                .send(task)
                .expect('Content-Type', /^application\/json/)
                .expect(201, task);
        });

    });

    describe('workflowsGetAllTasks', function () {
        it('should return a list of persisted graph objects', function () {
            var workflowTask = {
                friendlyName: 'dummy',
                injectableName: 'dummyName',
                options: {
                    oids: 'SNMPv2-MIB::sysDescr'
                }
            };
            workflowApiService.getTaskDefinitions.resolves([workflowTask]);
            return helper.request().get('/api/2.0/workflows/tasks')
                .expect('Content-Type', /^application\/json/)
                .expect(200)
                .expect(function (res) {
                    expect(workflowApiService.getTaskDefinitions).to.have.been.calledOnce;
                    expect(res.body).to.have.property('friendlyName', 'dummy');
                    expect(res.body).to.have.property('injectableName', 'dummyName');
                    expect(res.body).to.have.property('options').to.be.an('object');
                    expect(res.body).to.have.deep.property('options.oids', 'SNMPv2-MIB::sysDescr');
                });
        });

        it('should return an empty list of persisted graph objects', function () {
            var graph = [];
            workflowApiService.getTaskDefinitions.resolves(graph);

            return helper.request().get('/api/2.0/workflows/tasks')
                .expect('Content-Type', /^application\/json/)
                .expect(200, graph)
                .expect(function () {
                    expect(workflowApiService.getTaskDefinitions).to.have.been.calledOnce;
                });
        });

    });

    describe('workflowsGetTasksByName', function () {
        var workflowTask = {
            friendlyName: 'dummy',
            injectableName: 'dummyName',
            options: {
                oids: 'SNMPv2-MIB::sysDescr'
            }
        };

        it('should return a particular task persisted graph objects', function () {
            workflowApiService.getWorkflowsTasksByName.resolves(workflowTask);
            return helper.request().get('/api/2.0/workflows/tasks/'+workflowTask.injectableName)
            .expect('Content-Type', /^application\/json/)
            .expect(200)
            .expect(function ( res ) {
                expect(workflowApiService.getWorkflowsTasksByName).to.have.been.calledOnce;
                expect(workflowApiService.getWorkflowsTasksByName)
                    .to.have.been.calledWith(workflowTask.injectableName);
                expect(res.body).to.have.property('friendlyName', 'dummy');
                expect(res.body).to.have.property('injectableName', 'dummyName');
                expect(res.body).to.have.property('options').to.be.an('object');
                expect(res.body).to.have.deep.property('options.oids', 'SNMPv2-MIB::sysDescr');
            });
        });

        it('should return 404 when getWorkflowsTasksByName is not found', function () {
            var badGraphName = 'invalidName';
            var Errors = helper.injector.get('Errors');
            workflowApiService.getWorkflowsTasksByName.rejects(new Errors.NotFoundError('test'));
            views.render.resolves('{"message": "error"}');
            return helper.request().get('/api/2.0/workflows/tasks/'+badGraphName)
            .expect('Content-Type', /^application\/json/)
            .expect(404);
        });

    });

    describe('workflowsDeleteTasksByName', function () {
        var workflowTask;
        beforeEach(function () {
           return helper.request().put('/api/2.0/workflows/tasks')
            .send({
                friendlyName: 'dummy',
                injectableName: 'dummyName',
                options: {
                    oids: 'SNMPv2-MIB::sysDescr'
                }
            })
            .expect('Content-Type', /^application\/json/)
            .expect(201)
            .then(function (req) {
                workflowTask = req.body;
            });
        });

        it('should delete the Task with DELETE /workflows/tasks/injectableName', function () {
            return helper.request().delete('/api/2.0/workflows/tasks/'+ workflowTask.injectableName)
                .expect(204);
        });
    });

});
