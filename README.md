# on-taskgraph [![Build Status](https://travis-ci.org/RackHD/on-taskgraph.svg?branch=master)](https://travis-ci.org/RackHD/on-taskgraph) [![Code Climate](https://codeclimate.com/github/RackHD/on-taskgraph/badges/gpa.svg)](https://codeclimate.com/github/RackHD/on-taskgraph) [![Coverage Status](https://coveralls.io/repos/RackHD/on-taskgraph/badge.svg?branch=master&service=github)](https://coveralls.io/github/RackHD/on-taskgraph?branch=master)

'on-taskgraph' is the core workflow engine for RackHD, initiating workflows, performing tasks, and responding to ancillary services to enable the RackHD service.

For more in-depth information about the workflow engine [see our readthedocs page](http://rackhd.readthedocs.org/en/latest/rackhd/graphs.html?workflow-graphs).

Copyright 2015-2016, EMC, Inc.

## installation/setup

    npm install

    # For Linux
    apt-get install mongodb
    apt-get install rabbitmq-server

    # If on OSX, see http://brew.sh/ if brew is not installed
    brew install mongodb26
    brew install rabbitmq

## running

*NOTE: requires RabbitMQ and Mongo to be running to start and test correctly.*

This project can be run in one of three possible modes, [scheduler mode](#scheduler-mode), [task runner mode](#task-runner-mode), and [hybrid mode](#hybrid-mode):

If no mode is specified, it will run in [hybrid mode](#hybrid-mode) by default:

    node index.js

To run in [scheduler mode](#scheduler-mode):

    node index.js --scheduler
    # OR
    node index.js -s

To run in [task runner mode](#task-runner-mode):

    node index.js --runner
    # OR
    node index.js -r

To run a process within a [domain](#domains):

    node index.js <other args> --domain <domainname>
    # OR
    node index.js <other args> -d <domainname>

**Which mode should I run in?**

First, read the [descriptions of each mode](#modesconfigurations) below. Here are some guidelines for making this decision:

*If you have no concerns about fault tolerance or high performance. You are a normal user.*

- Run a single process in hybrid mode

*If you want to optimize for performance and speedy processing of a large volume of workflows*

- Run one process in Scheduler mode, and multiple processes in Task Runner mode. Make sure you create mongo indexes as detailed [above](#installationsetup).

*If you want to optimize for high availability*

- Run two processes in Scheduler mode (potentially on different machines) and run multiple processes in Task Runner mode (again distributing across machines if desired).
- This project achieves high availability by relying on access to highly available mongo database, so mongo must be run in a highly available configuration.

*If you want some degree of fault tolerance but don't care so much about 100% uptime (you can afford a few seconds of downtime on failure)*

- Run one process in Scheduler mode, and one or multiple processes in Task Runner mode. Coordinate these processes with a service manager to quickly restart them when they crash.
- Run mongo in a redundant configuration for higher degrees of fault tolerance.

To interact with the system externally, e.g. running graphs against live systems, you need to be running the following RackHD services:

- [on-http](https://github.com/RackHD/on-http/) (mandatory for all)
- [on-dhcp-proxy](https://github.com/RackHD/on-dhcp-proxy/) (mandatory for node graphs)
- [on-tftp](https://github.com/RackHD/on-tftp/) (mandatory for node booting graphs)

In addition, the system requires MongoDB, ISC DHCP, and RabbitMQ to be running and configured appropriately to enable PXE booting. More information is
available in the documentation for RackHD at http://rackhd.readthedocs.org

## Overview

This project provides functionality for running encapsulated jobs/units of work via
graph-based control flow mechanisms. For example, a typical graph consists of a list of
tasks, which themselves are essentially decorated functions. The graph definition specifies
any context and/or option values that should be handed to these functions, and more importantly,
it provides a mechanism for specifying when each task should be run. The most simple case is
saying a task should be run only after a previous task has succeeded (essentially becoming a
state machine). More complex graphs may involve event based task running, or defining
data/event channels that should exist between concurrently running tasks.

**Some architectural notes**

This project is designed to be able to be run with any number of workflow processes active at any time for performance and high availability reasons. 
Workflow processes can be configured to handle different domains of tasks, and can be machine independent as long as the database and messaging are shared.

*Atomic checkout*: All eligible Task Runners will receive requests to run tasks, but only one will succeed in checking out a lease to handle that request. Somewhat like a leased queue model, leveraging existing database technologies (currently MongoDB).

*Lease heartbeating*: Task Runner instances heartbeat their owned tasks, so that other instances can check them out on timed out heartbeats or process failures.

*Backup mechanisms for dropped events*: The primary mechanism for driving workflow execution is AMQP messaging, but on the case of failures or missed events, there are also database pollers that queue up dropped events for re-evaluation (dropped events can happen under high load throttling and process failure conditons).

*Stateless*: Horizontal scalability is achieved by designing the processes to run in essentially a stateless mode. The last word is from the database.

## Modes/Configurations

### Scheduler mode

In Scheduler mode the process will only take responsibility for evaluating workflow graphs and queuing tasks to be run by task runners.

### Task Runner mode

In Task Runner mode the process will listen/poll for queued tasks, and check them out to be run. It is in Task Runner mode that the the actual job code is executed.

### Hybrid mode

Hybrid mode runs both the Task Scheduler and Task Runner modes within one process.

### Domains

Domains allow for running a workflow process that only handles a subset of workflows and tasks, i.e. those within its domain. For example, you could run a workflow
on a specific network segment that handles all workflows for a subset of machines:

    node index.js --domain cluster1

If you then schedule workflows within the cluster1 domain, only this workflow process with network access to the machines will run those workflows.

Domains can also be useful under high load when certain classes of workflows need to be prioritized, such that a process or set of processes can be run
in a dedicated fashion only for that class of workflows.

## API commands

When running the on-http process, these are some common API commands you can send:

Note: Can use `/api/2.0` as well unless there is an explicit 2.0 API example

**Get available graphs**

```
GET
/api/1.1/workflows/library
```

**Run a new graph against a node**

Find the graph definition you would like to use, and copy the top-level *injectableName* attribute

```
POST
/api/1.1/nodes/<id>/workflows
{
    name: <graph name>
}
```

**Run a new graph not linked to a node**

Find the graph definition you would like to use, and copy the top-level *injectableName* attribute

```
POST
/api/1.1/workflows
{
    name: <graph name>
}
```

**Run a new graph within a domain**

Find the graph definition you would like to use, and copy the top-level *injectableName* attribute

```
POST
/api/1.1/workflows OR /api/1.1/nodes/<id>/workflows
{
    name: <graph name>,
    domain: <domain name>
}
```

This will return a serialized graph object.

**Query an active graph's state**

```
GET
/api/1.1/nodes/<id>/workflows/active
```

**2.0 API to list active workflow running against the node

```
GET
/api/2.0/nodes/<id>/workflows?active=true
```

**Create a new graph definition**

```
PUT
/api/1.1/workflows
{
    <json definition of graph>
}
```

### Creating new graphs

For more detailed information, see our [readthedocs page](http://rackhd.readthedocs.org/en/latest/rackhd/graphs.html?workflow-graphs).

Graph definition files must be saved as javascript or json files in `./lib/graphs/` (nested directories are okay), and filenames must match the pattern 
`*-graph.js` or `*-graph.json`. If a graph is saved as a `.js` file, it should export a javascript object conforming to the graph definition schema.
If a graph is saved as a `.json` file, it must be valid json.

Graph definitions can alternatively be uploaded through the API as detailed above in [API commands](#api-commands).

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


## Debugging/Profiling

To run in debug mode:

    sudo node debug index.js

You can also set `this.debug = true` in lib/task-scheduler.js and lib/task-runner.js for more verbose logging.

If you're using Node v4 or greater you can use `node-inspector` to debug and profile from a GUI.

    npm install node-inspector -g
    node-inspector --preload=false &
    sudo node --debug-brk index.js

Note: do not use the `node-debug` command it doesn't work as well.

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

## Building

Unversioned packages are built automatically from travis-ci and uploaded to bintray.com. Using
this repository is detailed in [the docs](http://rackhd.readthedocs.org/en/latest/rackhd/ubuntu_package_installation.html).

Build scripts are placed in the `extra/` directory.

  * `.travis.yml` will call the appropriate scripts in `extra/` to build an unversioned package.
  * `extra/make-sysdeps.sh` can be used to install system level packages in a Ubuntu system.
  * `extra/make-cicd.sh` will perform all the necessary build steps to generate a version package.

If you want to build your own versioned packages, you can use the Vagrantfile provided in `extra/`.  Simply perform `vagrant up` and it will run all the necessary steps.

