module.exports = SetupContext;

var di = require('di'),
    dot = require('dot-object')();

function SetupContext(logger) {
    function Context(optionOverrides){
        assert.notEqual(this, undefined, 'must be called as constructor');
        // take any overrides and apply them to our set of defaults
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

    Context.prototype.getProp = function (name) {
        logger.log(this.options.loggerLevel, "context.getProperty ("+ this.id +"): "+ name);
        this.stats.getProp += 1;
        return dot.pick(name, this.store.data);
    };

    Context.prototype.setProp = function (name, val) {
        logger.log(this.options.loggerLevel, "context.setProperty ("+ this.id +"): n=>"+ name + ", v=>" + val);
        this.stats.setProp += 1;
        dot.set(name, val, this.store.data);
        return this;
    };

    Context.prototype.getFunc = function (name) {
        logger.log(this.options.loggerLevel, "context.getFunc ("+ this.id +"): n=>"+ name);
        this.stats.getFunc += 1;
        return dot.pick(name, this.store.func);
    };

    Context.prototype.setFunc = function (name, val) {
        logger.log(this.options.loggerLevel, "context.setFunc ("+ this.id +"): n=>"+ name);
        this.stats.setFunc += 1;
        dot.set(name, val, this.store.func);
        return this;
    };

    return Context;
}
