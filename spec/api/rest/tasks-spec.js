// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Http.Api.Tasks', function () {
    var taskProtocol;
    var tasksApiService;
    var taskGraphApiService;
    var sandbox;
    var lookupService;
    var templates;

    before('start HTTP server', function () {
        this.timeout(20000);
        return helper.startServer();
    });

    beforeEach('set up mocks', function () {
        taskProtocol = helper.injector.get('Protocol.Task');
        // Defaults, you can tack on .resolves().rejects().resolves(), etc. like so
        taskProtocol.activeTaskExists = sinon.stub().resolves();
        taskProtocol.requestCommands = sinon.stub().resolves({
                                                            "identifier":"1234", 
                                                            "tasks": [ {"cmd": "testfoo"}
                                                             ]});
        taskProtocol.respondCommands = sinon.stub();

        tasksApiService = helper.injector.get('Http.Services.Api.Tasks');
        tasksApiService.getNode = sinon.stub();
        taskGraphApiService = helper.injector.get("Http.Services.Api.Taskgraph.Scheduler");

        lookupService = helper.injector.get('Services.Lookup');
        lookupService.ipAddressToMacAddress = sinon.stub().resolves('00:11:22:33:44:55');

        templates = helper.injector.get('Templates');

        sandbox = sinon.sandbox.create();
        return helper.reset().then(function(){
          return helper.injector.get('Views').load();
          });
    });

    afterEach('restoring stubs', function() {
        function resetStubs(obj) {
            _(obj).methods().forEach(function (method) {
                if (obj[method] && obj[method].reset) {
                    obj[method].reset();
                }
            }).value();
        }

        resetStubs(taskProtocol.activeTaskExists);
        resetStubs(taskProtocol.requestCommands);
        resetStubs(taskProtocol.respondCommands);
        resetStubs(tasksApiService.getNode);
        resetStubs(lookupService.ipAddressToMacAddress);

        sandbox.restore();
    });

    after('stop HTTP server', function () {
        return helper.reset().then(function(){
            return helper.stopServer();
        });
    });

    describe('GET /tasks/:id', function () {
        it("should send down tasks", function() {
            taskProtocol.activeTaskExists.resolves(null);
            sandbox.stub(taskGraphApiService, 'getTasksById').resolves({});
            return helper.request().get('/api/2.0/tasks/testnodeid')
            .expect(200)
            .expect(function (res) {
                expect(res.body).to.deep.equal({
                                               "identifier":"1234",
                                               "tasks": [ {"cmd": "testfoo"}
                                               ]});
            });
        });

        it("should return 404 if no active task exists", function() {
            var tasksApiService = helper.injector.get('Http.Services.Api.Tasks');
            taskProtocol.activeTaskExists.rejects(new tasksApiService.NoActiveTaskError());
            return helper.request().get('/api/2.0/tasks/testnodeid')
            .expect(404)
            .expect(function (res) {
                expect(res.body.message).to.deep.equal('Not Found');
            });
        });

        it("should error if an active task exists but no commands are sent", function() {
            sandbox.stub(taskGraphApiService, 'getTasksById').resolves({});
            taskProtocol.requestCommands.rejects(new Error(''));
            return helper.request().get('/api/2.0/tasks/testnodeid')
            .expect(404);
        });
    });

    describe("GET /tasks/bootstrap.js", function() {
        var stubTemplates;

        before(function() {
            stubTemplates = sinon.stub(templates, 'get');
            stubTemplates.withArgs('bootstrap.js').resolves({
                contents: 'test node id: <%= identifier %>'
            });
        });

        after(function() {
            stubTemplates.restore();
        });

       it("should render a bootstrap for the node", function() {
            tasksApiService.getNode.resolves({ id: '123' });
            return helper.request().get('/api/2.0/tasks/bootstrap.js?macAddress=00:11:22:33:44:55')
                .expect(200)
                .expect(function (res) {
                    expect(tasksApiService.getNode).to.have.been.calledWith('00:11:22:33:44:55');
                    expect(res.text).to.equal('test node id: 123');
                });
        });

        it("should render a 404 if node not found", function() {
            tasksApiService.getNode.resolves(null);
            return helper.request()
                .get('/api/2.0/tasks/bootstrap.js?macAddress=00:11:22:33:44:55')
                .expect(404);
        });

        it("should render a 400 if tasksApiService.getNode errors", function() {
            tasksApiService.getNode.rejects(new Error('asdf'));
            return helper.request()
                .get('/api/2.0/tasks/bootstrap.js?macAddress=00:11:22:33:44:55')
                .expect(400);
        });
    });

    describe("POST /tasks/:id", function () {
        it("should accept a large entity response", function() {
            var data = { foo: new Array(200000).join('1') };

            sandbox.stub(taskGraphApiService, 'postTaskById').resolves({});
            return helper.request().post('/api/2.0/tasks/123')
            .send(data)
            .expect(201)
            .expect(function () {
                expect(taskProtocol.respondCommands).to.have.been.calledWith('123', data);
            })
            .expect(201);
        });
    });
});
