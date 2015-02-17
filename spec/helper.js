'use strict';

var path = require('path');

require('renasar-core/spec/helper');

/**
*  set up di for testing
*/
var di = require('di');
var _ = require('lodash');
var core = require('renasar-core')(di);

global.helper = {

    /**
    * Helper for requiring files based on the cwd which is the root of the project.
    */
    require: function (file) {
        return require(this.relativeToRoot(file));
    },

    /**
    * Helper to generate a full path relative to the root directory.
    */
    relativeToRoot: function (file) {
        return path.normalize(process.cwd() + file);
    },
    /**
    * Most commonly used classes / modules, override or extend as needed
    * with child injector
    */
    baseInjector: new di.Injector(_.flatten([ // jshint ignore:line
        core.injectables,
        ])),

    startCore: function() {
        var config = helper.baseInjector.get('Services.Configuration');

        config.set('mongo', {
            adapter: 'mongo',
            host: 'localhost',
            port: 27017,
            database: 'renasar-pxe-test',
            user: '',
            password: ''
        });
        return helper.baseInjector.get('Services.Core').start();
    },

    // Mocha doesn't read the waterline validation errors because they
    // use rawStack instead of stack, so provide a convenience function to pass
    // all errors through where there is a chance they could be waterline ones
    handleError: function(error) {
        if (error.code === 'E_VALIDATION') {
            throw new Error("Validation error\n" + error.details + "\n" + error.rawStack);
        } else {
            throw error;
        }
    },

    startTaskGraphRunner: function(injector) {
        var config = injector.get('Services.Configuration');

        config.set('mongo', {
            adapter: 'mongo',
            host: 'localhost',
            port: 27017,
            database: 'renasar-pxe-test',
            user: '',
            password: ''
        });

        return injector.get('TaskGraph.Runner').start();
    },

    initializeWaterline: function (injector) {
        if (arguments.length === 0) {
            injector = this.baseInjector;
        }

        var waterline = injector.get('Services.Waterline');
        var config = injector.get('Services.Configuration');

        config.set('mongo', {
            adapter: 'mongo',
            host: 'localhost',
            port: 27017,
            database: 'renasar-pxe-test',
            user: '',
            password: ''
        });

        return waterline.start();
    },

    closeWaterline: function (injector) {
        if (arguments.length === 0) {
            injector = this.baseInjector;
        }

        var waterline = injector.get('Services.Waterline');

        return waterline.stop();
    },

    dropAndReinitialize: function(injector) {
        if (arguments.length === 0) {
            injector = this.baseInjector;
        }
        var Q = injector.get('Q');
        return helper.initializeWaterline(injector).then(function (waterline) { // jshint ignore:line
            /* drop doesn't actually return a promise, but leaving this Q.all in here in case
            * we need to switch to using destroy() */
            return Q.all(_.map(waterline, function (collection) { // jshint ignore:line
                if (typeof collection.drop === 'function') {
                    return collection.drop({});
                }
            })).then(function () {
                return waterline;
            });
        });
    }
};
