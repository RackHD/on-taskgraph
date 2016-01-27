/*
    Copyright (c) Microsoft.  All rights reserved.
    Microsoft Open Technologies would like to thank its contributors, a list
    of whom are at http://rx.codeplex.com/wikipage?title=Contributors.

    Licensed under the Apache License, Version 2.0 (the "License"); you
    may not use this file except in compliance with the License. You may
    obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
    implied. See the License for the specific language governing permissions
    and limitations under the License.
*/

// Some of the code below is adopted from https://github.com/Reactive-Extensions/RxJS

'use strict';

var di = require('di');

module.exports = rxMixins;
di.annotate(rxMixins, new di.Provide('Rx.Mixins'));
di.annotate(rxMixins,
    new di.Inject(
        'Rx',
        'Assert'
    )
);

function rxMixins(
    Rx,
    assert
) {
    var MergeLossyObserver = (function () {
        function MergeLossyObserver(o, concurrentCounter, g) {
            this.o = o;
            this.g = g;
            this.done = false;
            this.concurrentCounter = concurrentCounter;
            this.isStopped = false;
        }
        MergeLossyObserver.prototype.handleSubscribe = function (xs) {
            var sad = new Rx.SingleAssignmentDisposable();
            this.g.add(sad);
            Rx.helpers.isPromise(xs) && (xs = Rx.Observable.fromPromise(xs));
            sad.setDisposable(xs.subscribe(new InnerObserver(this, sad)));
        };
        MergeLossyObserver.prototype.onNext = function (innerSource) {
            if (this.isStopped) { return; }
            if (this.concurrentCounter.count < this.concurrentCounter.max) {
                this.concurrentCounter.count += 1;
                this.handleSubscribe(innerSource);
            }
        };
        MergeLossyObserver.prototype.onError = function (e) {
            if (!this.isStopped) {
                this.isStopped = true;
                this.o.onError(e);
            }
        };
        MergeLossyObserver.prototype.onCompleted = function () {
            if (!this.isStopped) {
                this.isStopped = true;
                this.done = true;
                this.concurrentCounter.count === 0 && this.o.onCompleted();
            }
        };
        MergeLossyObserver.prototype.dispose = function() { this.isStopped = true; };
        MergeLossyObserver.prototype.fail = function (e) {
            if (!this.isStopped) {
                this.isStopped = true;
                this.o.onError(e);
                return true;
            }

            return false;
        };

        function InnerObserver(parent, sad) {
            this.parent = parent;
            this.sad = sad;
            this.isStopped = false;
        }
        InnerObserver.prototype.onNext = function (x) {
            if(!this.isStopped) { this.parent.o.onNext(x); }
        };
        InnerObserver.prototype.onError = function (e) {
            if (!this.isStopped) {
                this.isStopped = true;
                this.parent.o.onError(e);
            }
        };
        InnerObserver.prototype.onCompleted = function () {
            if(!this.isStopped) {
                this.isStopped = true;
                var parent = this.parent;
                parent.g.remove(this.sad);
                parent.concurrentCounter.count -= 1;
                parent.done && parent.concurrentCounter.count === 0 && parent.o.onCompleted();
            }
        };
        InnerObserver.prototype.dispose = function() { this.isStopped = true; };
        InnerObserver.prototype.fail = function (e) {
            if (!this.isStopped) {
                this.isStopped = true;
                this.parent.o.onError(e);
                return true;
            }

            return false;
        };

        return MergeLossyObserver;
    }());

    function MergeLossyObservable(source, concurrentCounter) {
        this.source = source;
        this.concurrentCounter = concurrentCounter;
        Rx.ObservableBase.call(this);
    }
    Rx.internals.inherits(MergeLossyObservable, Rx.ObservableBase);

    MergeLossyObservable.prototype.subscribeCore = function(observer) {
        var g = new Rx.CompositeDisposable();
        g.add(this.source.subscribe(new MergeLossyObserver(observer, this.concurrentCounter, g)));
        return g;
    };

    Rx.Observable.prototype.mergeLossy = function(concurrentCounter) {
        assert.object(concurrentCounter);
        assert.number(concurrentCounter.count);
        assert.number(concurrentCounter.max);
        return new MergeLossyObservable(this, concurrentCounter);
    };

    Rx.Observable.prototype.flatMapWithLossyMaxConcurrent = function(
            countObj, selector, resultSelector, thisArg) {
        return new Rx.FlatMapObservable(this, selector, resultSelector, thisArg)
            .mergeLossy(countObj);
    };

    return Rx;
}
