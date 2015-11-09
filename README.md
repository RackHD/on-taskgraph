# on-taskgraph [![Build Status](https://travis-ci.org/RackHD/on-taskgraph.svg?branch=master)](https://travis-ci.org/RackHD/on-taskgraph) [![Code Climate](https://codeclimate.com/github/RackHD/on-taskgraph/badges/gpa.svg)](https://codeclimate.com/github/RackHD/on-taskgraph) [![Coverage Status](https://coveralls.io/repos/RackHD/on-taskgraph/badge.svg?branch=master&service=github)](https://coveralls.io/github/RackHD/on-taskgraph?branch=master)

'on-taskgraph' is the core workflow engine for RackHD, initiating workflows, performing tasks, and responding to ancillary services to enable the RackHD service

Copyright 2015, EMC, Inc.

## installation

    rm -rf node_modules
    npm install

## running

Note: requires RabbitMQ and mongod (if using the waterline/mongo driver) to be running to start and test correctly.

    sudo node index.js

To interact with the system externally, e.g. running graphs against live systems, you need to be running the following RackHD services:

- [on-http](https://github.com/RackHD/on-http/) (mandatory for all)
- [on-dhcp-proxy](https://github.com/RackHD/on-dhcp-proxy/) (mandatory for node graphs)
- [on-tftp](https://github.com/RackHD/on-tftp/) (mandatory for node booting graphs)

In addition, the system requires MongoDB, ISC DHCP, and RabbitMQ to be running and configured appropriately to enable PXE booting. More information is
available in the documentation for RackHD at http://rackhd.readthedocs.org

## Overview

This repository provides functionality for running encapsulated jobs/units of work via
graph-based control flow mechanisms. For example, a typical graph consists of a list of
tasks, which themselves are essentially decorated functions. The graph definition specifies
any context and/or option values that should be handed to these functions, and more importantly,
it provides a mechanism for specifying when each task should be run. The most simple case is
saying a task should be run only after a previous task has succeeded (essentially becoming a
state machine). More complex graphs may involve event based task running, or defining
data/event channels that should exist between concurrently running tasks.

## API commands

When running the on-http process, these are some common API commands you can send:

**Get available graphs**

```
GET
/api/common/workflows/library
```

**Run a new graph against a node**

Find the graph definition you would like to use, and copy the top-level *injectableName* attribute

```
POST
/api/common/nodes/<id>/workflows
{
    name: <graph name>
}
```

This will return a serialized graph object.

**Query an active graph's state**

```
GET
/api/common/nodes/<id>/workflows/active
```

**Create a new graph definition**

```
PUT
/api/common/workflows
{
    <json definition of graph>
}
```

### Creating new graphs

Graphs are defined via a JSON definition that conform to this schema:

- friendlyName (string): a human readable name for the graph
- injectableName (string): a unique name used by the system and the API to refer to the graph
- tasks (array of objects): a list of task definitions or references to task definitions. For an in-depth explanation
        of task definitions, see [the on-tasks README](https://hwstashprd01.isus.emc.com:8443/projects/ONRACK/repos/on-tasks/browse/README.md)
    - tasks.label (string): a unique string to be used as a reference within the graph definition
    - tasks.\[taskName\] (string): the injectableName of a task in the database to run. This or taskDefinition is required.
    - tasks.\[taskDefinition\] (object): an inline definition of a task, instead of one in the database. This or taskName is required.
    - tasks.\[ignoreFailure\] (boolean): ignoreFailure: true will prevent the graph from failing on task failure
    - tasks.\[waitOn\] (object): key, value pairs referencing other task labels to desired states of those tasks to trigger running on.
                                    Available states are 'succeeded', and 'failed' and 'finished' (run on succeeded or failed). If waitOn
                                    is not specified, the task will run on graph start.
- [options]
    - options.\[defaults\] (object): key, value pairs that will be handed to any tasks that have matching option keys
    - options.\<label\> (object): key, value pairs that should all be handed to a specific task


## debugging

To run in debug mode:

    sudo node debug index.js

## CI/testing

To run tests from a developer console:

    npm test

To run tests and get coverage for CI:

    # verify hint/style
    ./node_modules/.bin/jshint -c .jshintrc --reporter=checkstyle lib index.js > checkstyle-result.xml || true
    ./node_modules/.bin/istanbul cover -x "**/spec/**" _mocha -- $(find spec -name '*-spec.js') -R xunit-file --require spec/helper.js
    ./node_modules/.bin/istanbul report cobertura
    # if you want HTML reports locally
    ./node_modules/.bin/istanbul report html
