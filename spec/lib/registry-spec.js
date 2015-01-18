// Copyright 2014, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

require('../helper');
var _ = require('lodash'),
    util = require('util'),
    events = require('events');

function MockGraph(id) {
    this.instanceId = id;
    this.completeEventString = 'complete';
}
util.inherits(MockGraph, events.EventEmitter);

describe('Registry', function () {

    beforeEach(function() {
        this.injector = helper.baseInjector.createChild(
            _.flatten([
                helper.require('/lib/registry')
            ])
        );
        this.registry = this.injector.get('TaskGraph.Registry');
    });

    it("should not create multiple active graphs per target", function() {
        var self = this;
        expect(self.registry.fetchActiveGraphs()).to.be.empty;
        var graph = new MockGraph('testid1');
        self.registry.putActiveGraph(graph, 'testtarget1');
        expect(self.registry.fetchActiveGraphs()).to.have.length(1);
        expect(function() {
            graph = new MockGraph('testid2');
            self.registry.putActiveGraph(graph, 'testtarget1');
        }).to.throw("Unable to run multiple task graphs against a single target.");
        graph.emit(graph.completeEventString);
    });

    it("should be able to create subsequent graphs for a target after graph completion",
            function() {
        var self = this;
        expect(self.registry.fetchActiveGraphs()).to.be.empty;
        var graph = new MockGraph('testid1');
        self.registry.putActiveGraph(graph, 'testtarget1');
        expect(self.registry.fetchActiveGraphs()).to.have.length(1);
        graph.emit(graph.completeEventString);
        expect(self.registry.fetchActiveGraphs()).to.have.length(0);
        expect(function() {
            graph = new MockGraph('testid2');
            self.registry.putActiveGraph(graph, 'testtarget1');
        }).to.not.throw(Error);
        expect(self.registry.fetchActiveGraphs()).to.have.length(1);
    });
});
