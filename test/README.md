# Functional Integration Test Overview

The test suite is an open-source testing harness for RackHD software.
RackHD (https://github.com/RackHD) is the open-sourced Hardware Management and Orchestration
software developed by Dell Technologies for datacenter administration.

Written in Python 2.7 'unittest' and uses Nose (nosetests) as the test runner.

# Running Tests

## Requirements and Setup

Tests are intended to be run on Ubuntu 14+ Linux.
Test harness may be run on appliance host (localhost), or third party machine.
Deployment scripts must be run under third party Ubuntu Linux host.
Tests require the following virtual environment commands be executed:

    ./mkenv.sh
    source myenv_fit

## Directory Organization

The test framework is under on-taskgraph/test

- 'common' contains any common library functions
- 'stream-monitor' contains a nose-plugin to help with monitoring various
   streams (logs/amqp) and providing services around that

## Configuration

Default configuration file values can be found in the following files:
* 'config/rackhd_default.json'
* 'config/credentials_default.json'
* 'config/install_default.json'

Stack definitions are set from the 'config/stack_config.json' file.
An alternate configuration directory can be selected using the -config argument.

## Running the tests

All tests can be run from the wrapper 'run_tests.py':

### --help output
        usage: run_tests.py [-h] [-test TEST] [-config CONFIG] [-group GROUP]
                            [-stack STACK] [-rackhd_host RACKHD_HOST]
                            [-template TEMPLATE] [-xunit] [-numvms NUMVMS] [-list]
                            [-sku SKU] [-obmmac OBMMAC | -nodeid NODEID]
                            [-http | -https] [-port PORT] [-v V] [-nose-help]

        Command Help

        optional arguments:
          -h, --help            show this help message and exit
          -test TEST            test to execute, default: tests/
          -config CONFIG        config file location, default: config
          -group GROUP          test group to execute: 'smoke', 'regression',
                                'extended', default: 'all'
          -stack STACK          stack label (test bed)
          -rackhd_host RACKHD_HOST
                                RackHD appliance IP address or hostname, default:
                                localhost
          -template TEMPLATE    path or URL link to OVA template or RackHD OVA
          -xunit                generates xUnit XML report files
          -numvms NUMVMS        number of virtual machines for deployment on specified
                                stack
          -list                 generates test list only
          -sku SKU              node SKU name, example: Quanta-T41, default=all
          -obmmac OBMMAC        node OBM MAC address, example:00:1e:67:b1:d5:64
          -nodeid NODEID        node identifier string of a discovered node, example:
                                56ddcf9a8eff16614e79ec74
          -http                 forces the tests to utilize the http API protocol
          -https                forces the tests to utilize the https API protocol
          -port PORT            API port number override, default from
                                install_config.json
          -v V                  Verbosity level of console and log output (see -nose-
                                help for more options), Built Ins: 0: Minimal logging,
                                1: Display ERROR and CRITICAL to console and to files,
                                3: Display INFO to console and to files, 4: (default)
                                Display INFO to console, and DEBUG to files, 5:
                                Display infra.run and test.run DEBUG to both, 6: Add
                                display of test.data (rest calls and status) DEBUG to
                                both, 7: Add display of infra.data (ipmi, ssh) DEBUG
                                to both, 9: Display infra.* and test.* at DEBUG_9 (max
                                output)
          -nose-help            display help from underlying nosetests command,
                                including additional log options


### Example will run the smoke test:

    python run_tests.py -test tests -group smoke

The -stack or -rackhd_host argument can be omitted when running on the server or appliance. The test defaults to localhost:8080 for API calls.

### Running individual tests

Individual test scripts or tests may be executed using the following 'Nose' addressing scheme:

    test_script_path:classname.testname

## Hints and background for logging/debuging tests

Please read 'stream_monitor/flogging/README.md' for information on the logging system.
That file also contains a set of common "if you want this to happen, type this" at the top of the file and how
the existing '-v' shortcut option maps to the loggers.
