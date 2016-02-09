// Copyright 2016, EMC, Inc.

'use strict';

describe("Lease Expiration Poller", function() {
    var di = require('di');
    var core = require('on-core')(di, __dirname);

    var Poller,
        poller,
        Constants,
        Promise,
        store,
        Rx;

    var subscribeWrapper = function(done, cb) {
        return function(data) {
            try {
                cb(data);
                done();
            } catch (e) {
                done(e);
            }
        };
    };

    before(function() {
        helper.setupInjector([
            helper.require('/lib/lease-expiration-poller.js'),
            core.workflowInjectables
        ]);
        Rx = helper.injector.get('Rx');
        Poller = helper.injector.get('TaskGraph.LeaseExpirationPoller');
        store = helper.injector.get('TaskGraph.Store');
        Constants = helper.injector.get('Constants');
        Promise = helper.injector.get('Promise');
        this.sandbox = sinon.sandbox.create();
    });

    beforeEach(function() {
        this.sandbox.stub(store, 'findExpiredLeases');
        this.sandbox.stub(store, 'expireLease');
        poller = Poller.create({ schedulerId: 'testid', domain: 'default' }, {});
    });

    afterEach(function() {
        this.sandbox.restore();
    });

    it('constructor', function() {
        expect(poller.running).to.equal(false);
        expect(poller.leaseAdjust).to.equal(Constants.Task.DefaultLeaseAdjust);
        expect(poller.pollInterval).to.equal(Constants.Task.DefaultLeaseAdjust * 2);
        expect(poller.schedulerId).to.equal('testid');
        expect(poller.domain).to.equal('default');
    });


    it('start', function() {
        this.sandbox.stub(poller, 'pollTaskRunnerLeases');
        expect(poller.running).to.equal(false);
        poller.start();
        expect(poller.running).to.equal(true);
        expect(poller.pollTaskRunnerLeases).to.have.been.calledOnce;
    });


    it('stop', function() {
        this.sandbox.stub(poller, 'pollTaskRunnerLeases');
        expect(poller.running).to.equal(false);
        poller.start();
        poller.stop();
        expect(poller.running).to.equal(false);
    });

    it('isRunning', function() {
        poller.running = false;
        expect(poller.isRunning()).to.equal(false);
        poller.running = true;
        expect(poller.isRunning()).to.equal(true);
    });

    describe('expireLeases', function() {
        it('should not expire if no leases are found', function(done) {
            store.findExpiredLeases.resolves([]);

            poller.expireLeases()
            .subscribe(
                function() { done(new Error('Did not expect a call to onNext')); },
                done,
                subscribeWrapper(done, function() {
                    expect(store.expireLease).to.not.have.been.called;
                })
            );
        });

        it('should expire leases', function(done) {
            var leases = [
                { id: 'testid1' },
                { id: 'testid2' },
                { id: 'testid3' }
            ];
            store.findExpiredLeases.resolves(leases);
            store.expireLease.resolves();

            poller.expireLeases()
            .subscribe(
                function() {},
                done,
                subscribeWrapper(done, function() {
                    expect(store.findExpiredLeases).to.have.been.calledOnce;
                    expect(store.findExpiredLeases).to.have.been.calledWith(
                        poller.domain, poller.leaseAdjust);
                    expect(store.expireLease).to.have.been.calledThrice;
                    expect(store.expireLease.firstCall).to.have.been.calledWith('testid1');
                    expect(store.expireLease.secondCall).to.have.been.calledWith('testid2');
                    expect(store.expireLease.thirdCall).to.have.been.calledWith('testid3');
                })
            );
        });

        it('should handle stream errors', function(done) {
            store.findExpiredLeases.rejects(new Error('test'));
            this.sandbox.spy(poller, 'handleStreamError');

            poller.expireLeases()
            .subscribe(
                function() { done(new Error('Did not expect a call to onNext')); },
                done,
                subscribeWrapper(done, function() {
                    expect(poller.handleStreamError).to.have.been.calledOnce;
                    expect(poller.handleStreamError).to.have.been.calledWith(
                        'Error expiring task runner lease', new Error('test'));
                })
            );
        });
    });
});
