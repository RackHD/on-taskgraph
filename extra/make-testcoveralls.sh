#!/bin/bash

# Ensure we're always in the right directory.
SCRIPT_DIR="$( cd "$( dirname "$0" )" && pwd )"
cd $SCRIPT_DIR/..

./node_modules/.bin/istanbul cover -x "**/spec/**" ./node_modules/.bin/_mocha --report lcovonly -- $(find spec -name '*-spec.js') -R spec --require spec/helper.js
cat ./coverage/lcov.info | node_modules/.bin/coveralls

