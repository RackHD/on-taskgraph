// Copyright 2016, EMC, Inc.

'use strict';

describe('Graph Library', function () {
    var di = require('di');
    var core = require('on-core')(di, __dirname);

    var loader,
        store,
        TaskGraph,
        taskLibrary,
        env,
        Promise;

    function findAllValues(obj) {
        var allValues = _.map(obj, function(v) {
            if (v !== null && typeof v === 'object') {
                return findAllValues(v);
            } else {
                return v;
            }
        });
        return _.flattenDeep(allValues);
    }

    before(function() {
        helper.setupInjector([
            core.workflowInjectables,
            require('on-tasks').injectables,
            helper.require('/lib/loader')
        ]);
        TaskGraph = helper.injector.get('TaskGraph.TaskGraph');
        loader = helper.injector.get('TaskGraph.DataLoader');
        store = helper.injector.get('TaskGraph.Store');
        taskLibrary = helper.injector.get('Task.taskLibrary');
        env = helper.injector.get('Services.Environment');
        Promise = helper.injector.get('Promise');
        sinon.stub(store, 'getTaskDefinition', function(injectableName) {
            return Promise.resolve(_.find(taskLibrary, function(t) {
                return t.injectableName === injectableName;
            }));
        });
        sinon.stub(env, 'get').resolves({});
    });

    it("should validate all existing graphs not requiring user input for null values", function() {
        return Promise.map(loader.graphLibrary, function(_graph) {
            if (_.isEmpty(_graph.options)) {
                // Only validate tasks that don't explicitly have blanks
                // in their definitions (to be filled in by users)
                var skip = _.some(_graph.tasks, function(task) {
                    if (task.taskName) {
                        var _task = _.find(taskLibrary, function(t) {
                            return t.injectableName === task.taskName;
                        });
                        expect(_task, task.taskName).to.exist;
                        var options = _task.options;
                        return _.contains(findAllValues(options, null));
                    } else if (task.taskDefinition) {
                        return _.contains(findAllValues(task.taskDefinition.options), null);
                    }
                });
                if (!skip) {
                    return TaskGraph.create('default', { definition: _graph });
                }
            } else {
                // Only validate tasks that don't explicitly have blanks
                // in their definitions (to be filled in by users)
                if (!_.contains(findAllValues(_graph.options), null)) {
                    return TaskGraph.create('default', { definition: _graph });
                }
            }
        });
    });
});
