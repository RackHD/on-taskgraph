// Copyright 2015, EMC, Inc.
/* jshint: node:true */
'use strict';

var di = require('di'),
    dot = require('dot-object')(),
    uuid = require('node-uuid');

module.exports = factory;
di.annotate(factory, new di.Provide('Services.TaskContext'));
di.annotate(factory,
    new di.Inject(
        'Logger',
        'Assert',
        '_'
    )
);

/**
 * Injectable wrapper for dependencies
 * @param logger
 * @returns {TaskContext}
 */
function factory(Logger, assert, _) {
    var logger = Logger.initialize(factory);
    /**
     *  Task Context provides a place for tasks to store and retrieve
     *  information for shared access with other tasks within the task
     *  graph at run time.
     *
     * @param overrides
     * @returns {TaskContext.TaskContext}
     * @constructor
     */
    function TaskContext(overrides){
        if (!(this instanceof TaskContext)) {
            return new TaskContext(overrides);
        }

        var optionDefaults = {
            logLevel: 'info'
        };
        this.options = _.defaults(overrides || {}, optionDefaults);

        this.id = uuid.v4();

        this.store = {
            data: {},
            func: {}
        };

        this.stats = {
            created: new Date(),
            get: 0,
            set: 0,
            getFunc: 0,
            setFunc: 0
        };

        // curry logger for simplification of calling log
        this.log = function log(message, object) {
            assert.ok(logger[this.options.logLevel]);
            logger[this.options.logLevel](message, object);
        }.bind(this);
    }

    /**
     *
     * @param name
     * @returns {*}
     */
    TaskContext.prototype.get = function (name) {
        logger.log(this.options.loggerLevel, "get ("+ this.id +"): "+ name);
        this.stats.get += 1;
        return dot.pick(name, this.store.data);
    };

    /**
     *
     * @param name
     * @param val
     * @returns {TaskContext}
     */
    TaskContext.prototype.set = function (name, val) {
        logger.log(this.options.loggerLevel, "set ("+ this.id +"): n=>"+ name + ", v=>" + val);
        this.stats.set += 1;
        dot.set(name, val, this.store.data);
        return this;
    };


    /**
     * only valid in same process, using across process boudaries we drop this
     *
     * @param name
     * @returns {*}
     */
    TaskContext.prototype.getFunc = function (name) {
        logger.log(this.options.loggerLevel, "context.getFunc ("+ this.id +"): n=>"+ name);
        this.stats.getFunc += 1;
        return dot.pick(name, this.store.func);
    };

    /**
     *
     * @param name
     * @param val
     * @returns {TaskContext}
     */
    TaskContext.prototype.setFunc = function (name, val) {
        logger.log(this.options.loggerLevel, "context.setFunc ("+ this.id +"): n=>"+ name);
        this.stats.setFunc += 1;
        dot.set(name, val, this.store.func);
        return this;
    };

    return TaskContext;
}
