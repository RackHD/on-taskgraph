// Copyright 2015, Renasar Technologies Inc.
/* jshint node:true */

'use strict';

module.exports = {

    before: function (callback) {
        before(function () {
            callback(this);
        });
    },

    examples: function () {
        before(function () {
            expect(this.taskdefinition).to.be.ok;
            expect(this.taskdefinition).to.be.an.Object;
        });

        describe('expected properties', function() {

            it('should have a friendly name', function() {
                expect(this.taskdefinition).to.have.property('friendlyName');
                expect(this.taskdefinition.friendlyName).to.be.a('string');
            });

            it('should have an injectableName', function() {
                expect(this.taskdefinition).to.have.property('injectableName');
                expect(this.taskdefinition.injectableName).to.be.a('string');
            });

            it('should have tasks', function() {
                expect(this.taskdefinition).to.have.property('tasks');
                expect(this.taskdefinition.tasks).to.be.instanceof(Array);
            });

        });
    }
};
