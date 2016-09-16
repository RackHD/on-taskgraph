// Copyright 2016, EMC, Inc.

'use strict';

var di = require('di');
var path = require('path');

module.exports = schemaApiServiceFactory;

di.annotate(schemaApiServiceFactory, new di.Provide('Http.Api.Services.Schema'));
di.annotate(schemaApiServiceFactory,
    new di.Inject(
        'Services.Configuration',
        'Logger',
        'Promise',
        '_',
        'fs'
    )
);

function schemaApiServiceFactory(
    configuration,
    Logger,
    Promise,
    _,
    nodeFs
) {
    var logger = Logger.initialize(schemaApiServiceFactory);
    var fs = Promise.promisifyAll(nodeFs);
    var tv4 = require('tv4');
    var schemaNsMap = {};
    var schemaTitle = {};

    tv4.addFormat("ipv4", function (input) {
        var validator = require('validator');
        if (validator.isIP(input,4))
        {
            return null;
        } else
        {
            return input + " is not a valid IPv4 address!";
        }
    });

    function SchemaApiService() {
    }

    SchemaApiService.prototype.addNamespace = function( filePath, namespace ) {
        return fs.readdirAsync(filePath).filter(function(entry) {
                return (path.extname(entry) === '.json');
            }).map(function(entry) {
                return fs.readFileAsync(filePath + '/' + entry)
                    .then(function(contents) {
                        try {
                            var json = JSON.parse(contents);
                            tv4.addSchema(namespace + entry, json);
                            schemaNsMap[entry] = namespace;
                            if( _.has(json, 'title')) {
                                schemaTitle[json.title] = namespace + entry;
                            } else {
                                logger.warning('no title found in ' + entry);
                            }
                        } catch(err) {
                            logger.warning('error loading schema:' + entry);
                        }
                    });
            });
    };

    SchemaApiService.prototype.validate = function(obj, schemaName)  {
        return Promise.resolve().then(function() {
            var basename;

            // If a schemaName is specified, then validate against that
            if(schemaName) {
                basename = schemaName.split('#')[0];
                if (!_.has(schemaNsMap, basename))  {
                    return Promise.reject(schemaName + ' is not loaded');
                }
                return tv4.validateResult(obj, tv4.getSchema(schemaNsMap[basename] + schemaName));
            }
        }).then(function(result) {
            // Validate against all @odata.type fields declared
            var objResults = _(getObjectsWithKey(obj, '@odata.type'))
                .map(function(item) {
                    if(_.has(schemaTitle, item['@odata.type']))  {
                        schemaName = schemaTitle[item['@odata.type']];
                        return tv4.validateResult(item, tv4.getSchema(schemaName));
                    }
                })
                .unshift(result)
                .compact()
                .value();

            return _.transform(objResults, function(result, item) {
                if(result.valid === undefined) {
                    result.valid = item.valid;
                } else {
                    result.valid = item.valid ? result.valid : item.valid;
                }
                if(item.error) {
                    result.error = result.error || [];
                    result.error.push(item.error);
                }
                if(item.missing) {
                    result.missing = result.missing || [];
                    result.missing.push.apply(result.missing, item.missing);
                }
            });
        });
    };

    SchemaApiService.prototype.getNamespace = function( namespace ) {
        var re = new RegExp(namespace);
        var arr = tv4.getSchemaUris(re);
        return arr;
    };

    SchemaApiService.prototype.getSchema = function( identifier ) {
        var schemaContent = tv4.getSchema(identifier);
        return schemaContent;
    };

    function getObjectsWithKey(obj_, keys) {
        var res = [];
        var match = _.intersection(_.keys(obj_), _.isArray(keys) ? keys : [keys]);

        if (!_.isEmpty(match)) {
            res.push(obj_);
        }

        _.forEach(obj_, function(v) {
            if (typeof v === "object" && (v = getObjectsWithKey(v, keys)).length) {
                res.push.apply(res, v);
            }
        });

        return res;
    }

    return new SchemaApiService();
}
