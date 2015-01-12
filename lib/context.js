module.exports = TaskContext;

var di = require('di'),
    dot = require('dot-object')(),
    uuid = require('node-uuid');


di.annotate(lookupServiceFactory, new di.Provide('Services.TaskContext'));
di.annotate(lookupServiceFactory,
    new di.Inject(
        'Logger'
    )
);

/**
 * Injectable wrapper that provides the TaskContext class.
 * @param logger
 * @returns {TaskContext}
 * @constructor
 */
function TaskContext(logger) {
    /**
     *  Task Context provides a place for tasks to store and retrieve
     *  information for shared access with other tasks within the task
     *  graph at run time.
     *
     * @param optionOverrides
     * @returns {TaskContext.TaskContext}
     * @constructor
     */
    function TaskContext(optionOverrides){
        if (!(this instanceof TaskContext)) {
            return new TaskContext(optionOverrides);
        }

        var optionDefaults = { loggerLevel: 'silly' };
        this.options = lodash.defaults(optionOverrides | {}, optionDefaults);

        this.id = uuid.v4();

        this.store = {
            data: {},
            func: {}
        };

        this.stats = {
            created: new Date(),
            getProp: 0,
            setProp: 0,
            getFunc: 0,
            setFunc: 0
        };
    }

    /**
     *
     * @param name
     * @returns {*}
     */
    TaskContext.prototype.getProp = function (name) {
        logger.log(this.options.loggerLevel, "context.getProperty ("+ this.id +"): "+ name);
        this.stats.getProp += 1;
        return dot.pick(name, this.store.data);
    };

    /**
     *
     * @param name
     * @param val
     * @returns {TaskContext}
     */
    TaskContext.prototype.setProp = function (name, val) {
        logger.log(this.options.loggerLevel, "context.setProperty ("+ this.id +"): n=>"+ name + ", v=>" + val);
        this.stats.setProp += 1;
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
