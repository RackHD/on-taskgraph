function TaskBase(taskOverrides){
    assert.notEqual(this, undefined, 'must be called as constructor');

    this.cancelled = false;

    taskOverides = taskOverrides || {};
    this.instanceId = taskOverrides.instanceId || uuid();
    this.name = taskOverrides.name || this.instanceId;
    this.injectableTaskRunner =
        taskOverrides.injectableTaskRunner ||
        'default-task';
    this.waitingOn = taskOverides.waitingOn || [];
    this.status = 'waiting';
    this.tags = [];

    this.retriesAttempted = 0;
    this.retriesAllowed = taskOverides.retriesAllowed || 5;

    // overide as needed in children
}

TaskBase.prototype.waitOn = function(waitObject) {
    assert.equal(this.status, 'waiting', 'only newly initialized or still ' +
    'waiting tasks can add additional tasks to wait on');
    this.waitingOn.push(waitObject);
};

TaskBase.prototype.run = function(graph){
    // can assert/validate that when we are run, all of the tasks we are
    // waiting on can be confirmed as being in a state we accept as satisfying
    // our wait.  this allows us to ensure that we do not start before anything

    //graph is the context it is running in, graph contains information and
    //functions that allow this instance of a task runner to communicate the
    //success or failure of this function
};


//when someone finsihes a http requests for a specific file from a specifc ip
TaskBase.prototype.changeState = function(state) {

};

function TaskPromise(){

}
function TaskObservable(){

}

