// Copyright 2016, EMC, Inc.

'use strict';

describe('Rx Mixins', function () {
    var Rx;
    var Promise;

    before(function() {
        helper.setupInjector([
            helper.require('/lib/rx-mixins.js')
        ]);
        Rx = helper.injector.get('Rx.Mixins');
        Promise = helper.injector.get('Promise');
    });

    it('should merge lossy (drop async over max concurrent)', function(done) {
        var results = [];
        var counter = { count: 0, max: 2 };

        Rx.Observable.from([1,2,3,4,5])
        .map(function(val) {
            return Promise.resolve(val);
        })
        .mergeLossy(counter)
        .subscribe(
            function(val) {
                results.push(val);
            },
            done,
            function() {
                try {
                    expect(results).to.deep.equal([1,2]);
                    done();
                } catch (e) {
                    done(e);
                }
            }
        );
    });

    it('should handle errors', function(done) {
        var counter = { count: 0, max: 1 };
        var testError = new Error('test');

        Rx.Observable.from([1])
        .map(function() {
            return Promise.reject(testError);
        })
        .mergeLossy(counter)
        .subscribe(
            function () {},
            function(error) {
                try {
                    expect(error).to.equal(testError);
                    done();
                } catch (e) {
                    done(e);
                }
            }
        );
    });

    it('should flatMapWithLossyMaxConcurrent', function(done) {
        var results = [];
        var counter = { count: 0, max: 2 };

        Rx.Observable.from([1,2,3,4,5])
        .flatMapWithLossyMaxConcurrent(counter, function(val) {
            return Promise.resolve(val);
        })
        .subscribe(
            function(val) {
                results.push(val);
            },
            done,
            function() {
                try {
                    expect(results).to.deep.equal([1,2]);
                    done();
                } catch (e) {
                    done(e);
                }
            }
        );
    });
});
