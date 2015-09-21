// Copyright 2015, EMC, Inc.

'use strict';

require('on-core/spec/helper');

// Mocha doesn't read the waterline validation errors because they
// use rawStack instead of stack, so provide a convenience function to pass
// all errors through where there is a chance they could be waterline ones
helper.handleError = function(error) {
    if (error.code === 'E_VALIDATION') {
        throw new Error("Validation error\n" + error.details + "\n" + error.rawStack);
    } else {
        throw error;
    }
};
