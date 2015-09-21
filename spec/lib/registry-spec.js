// Copyright 2015, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Registry', function () {
    var registry;
    var waterline;
    var util = require('util'),
        events = require('events');

    function MockGraph(id) {
        this.instanceId = id;
        this.completeEventString = 'complete';
    }
    util.inherits(MockGraph, events.EventEmitter);

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

    before("Registry Spec Before: start registry services", function() {
        return helper.start([
            helper.require('/lib/registry'),
            helper.require('/lib/stores/memory'),
            helper.require('/lib/stores/waterline')
        ])
        .then(function() {
            registry = helper.injector.get('TaskGraph.Registry');
            waterline = helper.injector.get('Services.Waterline');
        });
    });

    beforeEach("Registry Spec beforeEach: reset stores", function() {
        return helper.reset()
        .then(function() {
            return registry.start();
        });
    });

    afterEach('Registry Spec: clear registry', function() {
        return registry.stop();
    });

    after('Registry Spec after: stop registry services', function() {
        return helper.stop();
    });

    it("should remove a task definition", function() {
        testTask.injectableName = 'Task.testRemove';

        return registry.registerTask(taskRegistryObject)
        .then(function() {
            return registry.fetchTaskDefinitionCatalog();
        })
        .then(function(tasks) {
            expect(tasks).to.have.length(1);
            return registry.removeTaskDefinition(testTask.injectableName);
        })
        .then(function() {
            return registry.fetchTaskDefinitionCatalog();
        })
        .then(function(tasks) {
            expect(tasks).to.be.empty;
        })
        .catch(function(e) {
            helper.handleError(e);
        });
    });

    it("should not create multiple database records for the same definition", function() {
        testTask.injectableName = 'Task.testRecords';

        return registry.fetchTaskDefinitionCatalog()
        .then(function(tasks) {
            expect(tasks).to.be.empty;
            return registry.registerTask(taskRegistryObject);
        })
        .then(function() {
            return registry.fetchTaskDefinitionCatalog();
        })
        .then(function(tasks) {
            expect(tasks).to.have.length(1);
            return registry.registerTask(taskRegistryObject);
        })
        .then(function() {
            return registry.fetchTaskDefinitionCatalog();
        })
        .then(function(tasks) {
            expect(tasks).to.have.length(1);
        })
        .catch(function(e) {
            helper.handleError(e);
        });
    });

    it("should update a task definition", function() {
        testTask.injectableName = 'Task.testUpdate';

        return registry.registerTask(taskRegistryObject)
        .then(function() {
            return registry.fetchTaskDefinitionCatalog();
        })
        .then(function(tasks) {
            expect(tasks).to.have.length(1);
            expect(tasks[0].properties).to.be.empty;

            testTask.properties.updateKey = 'updated';
            return registry.registerTask(taskRegistryObject);
        })
        .then(function() {
            return registry.fetchTaskDefinitionCatalog();
        })
        .then(function(tasks) {
            expect(tasks).to.have.length(1);
            expect(tasks[0].properties).to.have.property('updateKey')
                .that.equals('updated');
        })
        .catch(function(e) {
            helper.handleError(e);
        });
    });

    it("should not create multiple active graphs per target", function() {
        expect(registry.fetchActiveGraphsSync()).to.be.empty;
        var graph = new MockGraph('testid1');
        registry.putActiveGraphSync(graph, 'testtarget1');
        expect(registry.fetchActiveGraphsSync()).to.have.length(1);
        expect(function() {
            graph = new MockGraph('testid2');
            registry.putActiveGraphSync(graph, 'testtarget1');
        }).to.throw("Unable to run multiple task graphs against a single target.");
        graph.emit(graph.completeEventString);
    });

    it("should be able to create subsequent graphs for a target after graph completion",
            function() {
        expect(registry.fetchActiveGraphsSync()).to.be.empty;
        var graph = new MockGraph('testid1');
        registry.putActiveGraphSync(graph, 'testtarget1');
        expect(registry.fetchActiveGraphsSync()).to.have.length(1);
        graph.emit(graph.completeEventString);
        expect(registry.fetchActiveGraphsSync()).to.have.length(0);
        expect(function() {
            graph = new MockGraph('testid2');
            registry.putActiveGraphSync(graph, 'testtarget1');
        }).to.not.throw(Error);
        expect(registry.fetchActiveGraphsSync()).to.have.length(1);
    });

    it("should filter active graphs by target id", function() {
        expect(registry.fetchActiveGraphsSync()).to.be.empty;
        var graph = new MockGraph('testid1');
        registry.putActiveGraphSync(graph, 'testtarget1');
        expect(registry.fetchActiveGraphsSync()).to.have.length(1);

        var targetGraph = registry.fetchActiveGraphSync({ target: 'testtarget1' });
        expect(targetGraph).to.equal(graph);
    });

    it("should filter active graphs by graph id", function() {
        expect(registry.fetchActiveGraphsSync()).to.be.empty;
        var graph = new MockGraph('testid1');
        registry.putActiveGraphSync(graph, 'testtarget1');
        expect(registry.fetchActiveGraphsSync()).to.have.length(1);

        var targetGraph = registry.fetchActiveGraphSync({ instanceId: 'testid1' });
        expect(targetGraph).to.equal(graph);
    });

    it("should fetch graph history", function() {
        registry.graphHistoryStore.getAll = sinon.stub();
        registry.fetchGraphHistory({ testfilter: 1 });
        expect(registry.graphHistoryStore.getAll).to.have.been.calledWith({ testfilter: 1 });
    });

    it("should fetch a task definition", function() {
        registry.taskDefinitionStore.get = sinon.stub();
        registry.fetchTaskDefinition('Test name');
        expect(registry.taskDefinitionStore.get).to.have.been.calledWith('Test name');
    });

    it("should fetch a graph definition", function() {
        registry.graphDefinitionStore.get = sinon.stub();
        registry.fetchGraphDefinition('Test name');
        expect(registry.graphDefinitionStore.get).to.have.been.calledWith('Test name');
    });

    it("should not fetch an active graph with no filter", function() {
        expect(registry.fetchActiveGraphSync()).to.equal(undefined);
    });
});
