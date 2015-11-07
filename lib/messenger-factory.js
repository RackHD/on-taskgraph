// Copyright 2015, EMC, Inc.
'use strict';

var di = require('di');

module.exports = MessengerFactory;
di.annotate(MessengerFactory, new di.Provide('Task.Messenger'));
di.annotate(MessengerFactory,
        new di.Inject(
            'Services.Configuration',
            di.Injector
    )
);

function MessengerFactory(config, injector) {
    var messenger = config.get('messenger', 'mongo');
    switch(messenger) {
        case 'AMQP':
            return injector.get('Task.Messenger.AMQP');
        case 'mongo':
            return injector.get('Task.Messenger.mongo');
        default:
            throw new Error('Unknown messenger: ' + messenger);
    }
}
