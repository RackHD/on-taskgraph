// Copyright 2015, EMC, Inc.
/* jshint: node:true */
'use strict';

var di = require('di');

module.exports = waterlineStoreFactory;
di.annotate(waterlineStoreFactory, new di.Provide('TaskGraph.Stores.Waterline'));
di.annotate(waterlineStoreFactory,
    new di.Inject(
        'Services.Waterline',
        'Logger',
        'Assert',
        'Q',
        '_'
    )
);

function waterlineStoreFactory(waterline, Logger, assert, Q, _) {
    var logger = Logger.initialize(waterlineStoreFactory);

    function WaterlineStore(modelName, defaultQueryKey) {
        logger;
        assert.string(modelName);
        assert.object(waterline[modelName]);
        this.defaultQueryKey = defaultQueryKey;
        this.model = waterline[modelName];
    }

    WaterlineStore.prototype.put = function(queryValue, value, queryKey) {
        var self = this;

        queryKey = queryKey || self.defaultQueryKey;
        var query = {};
        query[queryKey] = queryValue;
        return Q.resolve(
            self.model.findOne(query)
            .then(function(doc) {
                if (!_.isEmpty(doc)) {
                    return self.model.update(query, value);
                } else {
                    return self.model.create(value);
                }
            })
        );
    };

    WaterlineStore.prototype.get = function(queryValue, queryKey) {
        queryKey = queryKey || this.defaultQueryKey;
        var query = {};
        query[queryKey] = queryValue;
        return Q.resolve(this.model.findOne(query))
        .then(function(doc) {
            return doc ? doc.toJSON() : doc;
        });
    };

    WaterlineStore.prototype.getAll = function(filter) {
        return Q.resolve(this.model.find(filter || {}))
        .then(function(docs) {
            return _.map(docs, function(doc) {
                return doc.toJSON();
            });
        });
    };

    WaterlineStore.prototype.remove = function(queryValue, queryKey) {
        queryKey = queryKey || this.defaultQueryKey;
        var query = {};
        query[queryKey] = queryValue;
        return Q.resolve(this.model.destroy(query));
    };

    return WaterlineStore;
}
