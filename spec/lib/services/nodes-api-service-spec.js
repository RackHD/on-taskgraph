// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved.

"use strict";

describe("Http.Services.Api.Nodes", function () {
    var nodeApiService;
    var waterline;
    var findByIdentifier;

    before("Http.Services.Api.Nodes before", function() {
        helper.setupInjector([
            helper.require("/lib/services/nodes-api-service")
        ]);
        nodeApiService = helper.injector.get("Http.Services.Api.Nodes");
        waterline = helper.injector.get('Services.Waterline');
        waterline.nodes = {
            findByIdentifier: function() {}
        };
        this.sandbox = sinon.sandbox.create();
    });

    beforeEach("Http.Services.Api.Nodes beforeEach", function() {
        findByIdentifier = this.sandbox.stub(waterline.nodes, 'findByIdentifier');
    });

    afterEach("Http.Services.Api.Nodes afterEach", function() {
        this.sandbox.restore();
    });

    describe('getNodeByIdentifier', function() {
        it('should get the node specified by identifier', function () {
            var node = {
                id: '123'
            };
            waterline.nodes.findByIdentifier.resolves(node);

            return nodeApiService.getNodeByIdentifier(node.id)
                .then(function(resp) {
                    expect(findByIdentifier).to.have.been.calledOnce;
                    expect(findByIdentifier).to.have.been.calledWith(node.id);
                    expect(resp).to.deep.equal(node);
                });
        });

    });
});
