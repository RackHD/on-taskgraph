// Copyright 2014, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

require('../helper');
var _ = require('lodash'),
    util = require('util'),
    events = require('events'),
    Q = require('q');

function MockGraph(id) {
    this.instanceId = id;
    this.completeEventString = 'complete';
}
util.inherits(MockGraph, events.EventEmitter);

before("before registry-spec", function() {
    var self = this;

    self.injector = helper.baseInjector.createChild(
        _.flatten([
            helper.require('/lib/registry'),
            helper.require('/lib/stores/memory'),
            helper.require('/lib/stores/waterline')
        ])
    );
    self.registry = self.injector.get('TaskGraph.Registry');
    self.waterline = self.injector.get('Services.Waterline');
    return helper.startCore(self.injector)
    .catch(function(e) {
        helper.handleError(e);
    });
});

describe('Registry', function () {
    var testTask = {
        friendlyName: 'Base test task remove',
        implementsTask: 'Task.Base.test',
        options: { option1: 1, option2: 2, option3: 3 },
        properties: {}
    };
    var taskRegistryObject = {
        definition: testTask,
        create: sinon.stub()
    };

    beforeEach("beforeEach registry-spec", function() {
        var self = this;
        return Q.all([
            self.waterline.taskdefinitions.drop({}),
            self.waterline.graphdefinitions.drop({}),
            self.waterline.graphobjects.drop({})
        ])
        .then(function() {
            return self.registry.start();
        });
    });

    afterEach(function() {
        return this.registry.stop();
    });

    it("should remove a task definition", function() {
        var self = this;
        testTask.injectableName = 'Task.testRemove';

        return self.registry.registerTask(taskRegistryObject)
        .then(function() {
            return self.registry.fetchTaskDefinitionCatalog();
        })
        .then(function(tasks) {
            expect(tasks).to.have.length(1);
            return self.registry.removeTaskDefinition(testTask.injectableName);
        })
        .then(function() {
            return self.registry.fetchTaskDefinitionCatalog();
        })
        .then(function(tasks) {
            expect(tasks).to.be.empty;
        })
        .catch(function(e) {
            helper.handleError(e);
        });
    });

    it("should not create multiple database records for the same definition", function() {
        var self = this;
        testTask.injectableName = 'Task.testRecords';

        return self.registry.fetchTaskDefinitionCatalog()
        .then(function(tasks) {
            expect(tasks).to.be.empty;
            return self.registry.registerTask(taskRegistryObject);
        })
        .then(function() {
            return self.registry.fetchTaskDefinitionCatalog();
        })
        .then(function(tasks) {
            expect(tasks).to.have.length(1);
            return self.registry.registerTask(taskRegistryObject);
        })
        .then(function() {
            return self.registry.fetchTaskDefinitionCatalog();
        })
        .then(function(tasks) {
            expect(tasks).to.have.length(1);
        })
        .catch(function(e) {
            helper.handleError(e);
        });
    });

    it("should update a task definition", function() {
        var self = this;
        testTask.injectableName = 'Task.testUpdate';

        return self.registry.registerTask(taskRegistryObject)
        .then(function() {
            return self.registry.fetchTaskDefinitionCatalog();
        })
        .then(function(tasks) {
            expect(tasks).to.have.length(1);
            expect(tasks[0].toJSON().properties).to.be.empty;

            testTask.properties.updateKey = 'updated';
            return self.registry.registerTask(taskRegistryObject);
        })
        .then(function() {
            return self.registry.fetchTaskDefinitionCatalog();
        })
        .then(function(tasks) {
            expect(tasks).to.have.length(1);
            expect(tasks[0].toJSON().properties).to.have.property('updateKey')
                .that.equals('updated');
        })
        .catch(function(e) {
            helper.handleError(e);
        });
    });

    it("should not create multiple active graphs per target", function() {
        var self = this;
        expect(self.registry.fetchActiveGraphsSync()).to.be.empty;
        var graph = new MockGraph('testid1');
        self.registry.putActiveGraphSync(graph, 'testtarget1');
        expect(self.registry.fetchActiveGraphsSync()).to.have.length(1);
        expect(function() {
            graph = new MockGraph('testid2');
            self.registry.putActiveGraphSync(graph, 'testtarget1');
        }).to.throw("Unable to run multiple task graphs against a single target.");
        graph.emit(graph.completeEventString);
    });

    it("should be able to create subsequent graphs for a target after graph completion",
            function() {
        var self = this;
        expect(self.registry.fetchActiveGraphsSync()).to.be.empty;
        var graph = new MockGraph('testid1');
        self.registry.putActiveGraphSync(graph, 'testtarget1');
        expect(self.registry.fetchActiveGraphsSync()).to.have.length(1);
        graph.emit(graph.completeEventString);
        expect(self.registry.fetchActiveGraphsSync()).to.have.length(0);
        expect(function() {
            graph = new MockGraph('testid2');
            self.registry.putActiveGraphSync(graph, 'testtarget1');
        }).to.not.throw(Error);
        expect(self.registry.fetchActiveGraphsSync()).to.have.length(1);
    });

    it("should filter active graphs by target id", function() {
        var self = this;
        expect(self.registry.fetchActiveGraphsSync()).to.be.empty;
        var graph = new MockGraph('testid1');
        self.registry.putActiveGraphSync(graph, 'testtarget1');
        expect(self.registry.fetchActiveGraphsSync()).to.have.length(1);

        var targetGraph = self.registry.fetchActiveGraphSync({ target: 'testtarget1' });
        expect(targetGraph).to.equal(graph);
    });

    it("should filter active graphs by graph id", function() {
        var self = this;
        expect(self.registry.fetchActiveGraphsSync()).to.be.empty;
        var graph = new MockGraph('testid1');
        self.registry.putActiveGraphSync(graph, 'testtarget1');
        expect(self.registry.fetchActiveGraphsSync()).to.have.length(1);

        var targetGraph = self.registry.fetchActiveGraphSync({ instanceId: 'testid1' });
        expect(targetGraph).to.equal(graph);
    });
});
