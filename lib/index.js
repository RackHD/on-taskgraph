// Copyright 2014, Renasar Technologies Inc.
/* jshint: node:true */
'use strict';

var myExports;
module.exports = myExports =  {
    taskGraphSetup: require("./taskgraph"),
    taskSetup: require("./task"),
    contextSetup: require("./context"),
    schedulerSetup: require("./scheduler")
};

if (require.main === module) {
//    var di = require('di'),
//        _ = require('lodash'),
//        core = require('renasar-core')(di),
//        injector = new di.Injector(
//            _.flatten([
//                core.injectables,
//    var uuid = require('node-uuid');
//    var EventEmitter2 = require('eventemitter2').EventEmitter2;
//    require('./taskgraph')
//]);
//    taskgraph = injector.get('taskgraph');
//
//    modules.export = taskgraph;
//
//    main();
}