// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved

'use strict';

require('../../helper');

describe("Schema API Service", function() {
    var validator;
    var template;
    var _;
    var testObj = {
        'name': 'node1',
        'type': 'compute'
    };

    before(function() {
        helper.setupInjector([
            helper.require("/lib/services/schema-api-service"),
            helper.di.simpleWrapper(function() { arguments[1](); }, 'rimraf')
        ]);
        validator = helper.injector.get('Http.Api.Services.Schema');
        template = helper.injector.get('Templates');
        _ = helper.injector.get('_');

        sinon.stub(template, "get").resolves({contents: JSON.stringify(testObj)});

        var path = helper.injector.get('path');
        return validator.addNamespace(path.resolve(__dirname, '../../../static/schemas/2.0'),
            'rackhd/schemas/v2/');
    });

    beforeEach(function() {
        template.get.reset();
    });

    helper.after(function () {
        template.get.restore();
    });

    it('should validate an object against a valid schema', function() {
        var schemaName = 'node.2.0.json#/definitions/Node';
        return validator.validate(testObj, schemaName)
            .then(function(result) {
                expect(result.error).to.be.empty;
                expect(result.missing).to.be.empty;
                expect(result.valid).to.be.true;
            });
    });

    it('should fail an invalid object with a valid schema', function() {
        var obj = _.merge({}, testObj, { extraParam: 'bad' });
        var schemaName = 'node.2.0.json#/definitions/Node';
        return validator.validate(obj, schemaName)
            .then(function(result) {
                expect(result.error).have.length(1);
                expect(result.missing).to.be.empty;
                expect(result.valid).to.be.false;
            });
    });

    it('should fail when invalid schema is specified', function() {
        var schemaName = 'foo';
        return expect(validator.validate(testObj, schemaName))
            .to.be.rejectedWith(/is not loaded/);
    });

});
