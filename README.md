# renasar-taskgraph

job network/graph runner

## installation


    rm -rf node_modules
    npm install

## running

Note: requires RabbitMQ to be running to start and test correctly.

    sudo node index.js

## debuging

To run in debug mode:


    sudo node --debug index.js

## CI/testing

To run tests from a developer console:


    npm test

To run tests and get coverage for CI:


    # verify hint/style
    ./node_modules/.bin/jshint -c .jshintrc --reporter=checkstyle lib index.js > checkstyle-result.xml || true
    ./node_modules/.bin/istanbul cover _mocha -- $(find spec -name '*-spec.js') -R xunit-file --require spec/helper.js
    ./node_modules/.bin/istanbul report cobertura