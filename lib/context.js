module.exports = Context;

function Context(ownerId, initialContext) {
    this.contextOwner = ownerId;

    this.store = {
        data: {},
        func: {}
    };

    this.stats = {
        created: new Date(),
        getProp:0,
        setProp:0,
        getFunc:0,
        setFunc:0
    };
}

Context.prototype.getProp = function(name) {
    //TODO: log
    this.stats.getProp += 1;
    return this.store.data[name];
};

Context.prototype.setProp = function(name, val) {
    //TODO: log
    this.stats.setProp += 1;
    this.store.data[name] = val;
    return this;
};

Context.prototype.getFunc = function(name) {
    //TODO: log
    this.stats.getFunc += 1;
    return this.store.func[name];
};

Context.prototype.setFunc = function(name, val) {
    //TODO: log
    this.stats.setFunc += 1;
    this.store.func[name] = val;
    return this;
};
