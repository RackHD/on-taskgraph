// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di');

module.exports = leaseExpirationPollerFactory;
di.annotate(leaseExpirationPollerFactory, new di.Provide('TaskGraph.LeaseExpirationPoller'));
di.annotate(leaseExpirationPollerFactory,
    new di.Inject(
        'TaskGraph.Store',
        'Logger',
        'Assert',
        'Constants',
        'Rx',
        '_'
    )
);

function leaseExpirationPollerFactory(
    store,
    Logger,
    assert,
    Constants,
    Rx,
    _
) {
    var logger = Logger.initialize(leaseExpirationPollerFactory);

    /**
     * The LeaseExpirationPoller polls the store for any active task documents
     * whose TaskRunnerLease heartbeat timer has expired, and resets them to
     * be scheduled again.
     *
     * @param {Object} scheduler - A TaskScheduler object
     * @param {Object} options
     * @constructor
     */
    function LeaseExpirationPoller(scheduler, options) {
        options = options || {};
        assert.object(scheduler);
        assert.string(scheduler.schedulerId);
        assert.string(scheduler.domain);
        this.running = false;
        this.leaseAdjust = options.leaseAdjust || Constants.Task.DefaultLeaseAdjust;
        this.pollInterval = options.pollInterval || this.leaseAdjust * 2;
        this.schedulerId = scheduler.schedulerId;
        this.domain = scheduler.domain;
    }

    /**
     * Poll the store for expired leases, and set each ones TaskRunnerLease to null.
     *
     * @memberOf LeaseExpirationPoller
     */
    LeaseExpirationPoller.prototype.pollTaskRunnerLeases = function() {
        var self = this;
        assert.ok(self.running, 'lease expiration poller is running');

        Rx.Observable.interval(self.pollInterval)
        .takeWhile(self.isRunning.bind(self))
        .flatMap(self.expireLeases.bind(self))
        .subscribe(
            function(expired) {
                if (!_.isEmpty(expired)) {
                    logger.info('Found expired lease for TaskRunner', {
                        objectId: expired._id.toString(),
                        expiredTaskRunnerId: expired.taskRunnerId,
                        schedulerId: self.schedulerId,
                        domain: self.domain
                    });
                }
            },
            self.handleStreamError.bind(self, 'Error with lease expiration stream')
        );
    };

    /**
     * Query the store for expired leases, and set each ones TaskRunnerLease to null.
     *
     * @memberOf LeaseExpirationPoller
     */
    LeaseExpirationPoller.prototype.expireLeases = function() {
        return Rx.Observable.just()
        .flatMap(store.findExpiredLeases.bind(store, this.domain, this.leaseAdjust))
        .flatMap(function(docs) { return Rx.Observable.from(docs); })
        .map(function(doc) { return doc.id; })
        .flatMap(store.expireLease.bind(store))
        .catch(this.handleStreamError.bind(this, 'Error expiring task runner lease'));
    };

    /**
     * This is used with Rx.Observable.prototype.takeWhile in each Observable
     * created by LeaseExpirationPoller.prototype.initializePipeline. When isRunning()
     * returns false, all the observables will automatically dispose.
     *
     * @memberOf LeaseExpirationPoller
     */
    LeaseExpirationPoller.prototype.isRunning = function() {
        return this.running;
    };

    /**
     * Log handler for observable onError failure events.
     *
     * @param {String} msg
     * @param {Object} err
     * @memberOf LeaseExpirationPoller
     */
    LeaseExpirationPoller.prototype.handleStreamError = function(msg, err) {
        logger.error(msg, {
            schedulerId: this.schedulerId,
            // stacks on some error objects (particularly from the assert library)
            // don't get printed if part of the error object so separate them out here.
            error: _.omit(err, 'stack'),
            stack: err.stack
        });
        return Rx.Observable.empty();
    };

    /**
     * @memberOf LeaseExpirationPoller
     */
    LeaseExpirationPoller.prototype.start = function() {
        this.running = true;
        this.pollTaskRunnerLeases();
    };

    /**
     * @memberOf LeaseExpirationPoller
     */
    LeaseExpirationPoller.prototype.stop = function() {
        this.running = false;
    };

    /**
     * @memberOf LeaseExpirationPoller
     */
    LeaseExpirationPoller.create = function(scheduler, options) {
        return new LeaseExpirationPoller(scheduler, options);
    };

    return LeaseExpirationPoller;
}
