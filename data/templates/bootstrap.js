// Copyright 2015, EMC, Inc.

"use strict";

var http = require('http'),
    url = require('url'),
    fs = require('fs'),
    path = require('path'),
    childProcess = require('child_process'),
    exec = childProcess.exec,
    server = '<%=server%>',
    port = '<%=port%>',
    tasksPath = '/api/current/tasks/<%=identifier%>',
    // Set the buffer size to ~5MB to accept all output in flashing bios
    // Otherwise the process will be killed if exceeds the buffer size
    MAX_BUFFER = 5000 * 1024,
    MAX_RETRY_TIMEOUT = 60 * 1000;
/**
 * Synchronous each loop from caolan/async.
 * @private
 * @param arr
 * @param iterator
 * @param callback
 * @returns {*|Function}
 */
function eachSeries(arr, iterator, callback) {
    callback = callback || function () {};

    if (!arr.length) {
        return callback();
    }

    var completed = 0,
        iterate = function () {
            iterator(arr[completed], function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                } else {
                    completed += 1;
                    if (completed >= arr.length) {
                        callback();
                    } else {
                        iterate();
                    }
                }
            });
        };

    iterate();
}

/**
 * Update Tasks - Takes the data from task execution and posts it back to the
 * API server.
 * @private
 * @param data
 * @param timeout
 */
function updateTasks(data, timeout, retry, retries) {

    var request = http.request({
        hostname: server,
        port: port,
        path: tasksPath,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    }, function (res) {
        res.on('data', function () {
            // no-op to end the async call
        });

        res.on('end', function () {
            if (timeout && data.exit === undefined) {
                console.log("Sleeping " + timeout + " for Task Execution...");

                setTimeout(function () {
                    getTasks(timeout);
                }, timeout);
            } else {
                console.log("Task Execution Complete");
                process.exit(data.exit.code || data.exit || 0);
            }
        });
    }).on('error', function (err) {
            console.log("Update Tasks Error: " + err);
            if (retries === undefined){
                retries = 1;
            }else {
                retries = retries + 1;
            }
            console.log("Retrying Update Tasks Attempt #" + retries);

            setTimeout(function () {
                updateTasks(data, timeout, retry, retries);
            }, Math.min(timeout * retries, MAX_RETRY_TIMEOUT));
        });

    // Call error.toString() on certain errors so when it is JSON.stringified
    // it doesn't end up as '{}' before we send it back to the server.
    data.tasks.forEach(function(task) {
        if (task.error && !task.error.code) {
            task.error = task.error.toString();
        }
    });

    request.write(JSON.stringify(data));
    request.write("\n");
    request.end();
}

/**
 * Execute Tasks - Tasks the data from get tasks and executes each task serially
 * @private
 * @param data
 * @param timeout
 */
function executeTasks(data, timeout) {
    var handleExecResult = function(_task, _done, error, stdout, stderr) {
        _task.stdout = stdout;
        _task.stderr = stderr;
        _task.error = error;

        console.log(_task.stdout);
        console.log(_task.stderr);

        if (_task.error !== null) {
            console.log("_task Error (" + _task.error.code + "): " +
                        _task.stdout + "\n" +
                        _task.stderr + "\n" +
                        _task.error.toString());
            console.log("ACCEPTED RESPONSES " + _task.acceptedResponseCodes);
            if (checkValidAcceptCode(_task.acceptedResponseCodes) &&
                _task.acceptedResponseCodes.indexOf(_task.error.code) >= 0) {

                console.log("_task " + _task.cmd + " error code " + _task.error.code +
                   " is acceptable, continuing...");
                _done();
            } else {
                _done(error);
            }
        } else {
            _done();
        }
    };

    eachSeries(data.tasks, function (task, done) {
        if (task.downloadUrl) {
            getFile(task.downloadUrl, function(error) {
                if (error) {
                    handleExecResult(task, done, error);
                } else {
                    console.log(task.cmd);
                    exec(task.cmd, { maxBuffer: MAX_BUFFER }, function(error, stdout, stderr) {
                        handleExecResult(task, done, error, stdout, stderr);
                    });
                }
            });
        } else {
            console.log(task.cmd);
            exec(task.cmd, { maxBuffer: MAX_BUFFER }, function (error, stdout, stderr) {
                if (error) {
                    handleExecResult(task, done, error);
                } else {
                    handleExecResult(task, done, error, stdout, stderr, done);
                }
            });
        }
    }, function () {
        updateTasks(data, timeout);
    });
}

/**
 * Get Tasks - Retrieves a task list from the API server.
 * @private
 * @param timeout
 */
function getTasks(timeout) {
    http.request({
        hostname: server,
        port: port,
        path: tasksPath,
        method: 'GET'
    }, function (res) {
        var data = "";

        res.on('data', function (chunk) {
            data += chunk;
        });

        res.on('end', function () {
            try {
                executeTasks(JSON.parse(data), timeout);
            } catch (error) {
                // 404 error doesn't run through the on error handler.
                console.log("No tasks available.");

                if (timeout) {
                    console.log("Sleeping " + timeout +
                                    " for Task Execution...");

                    setTimeout(function () {
                        getTasks(timeout);
                    }, timeout);
                } else {
                    console.log("Task Execution Complete");
                }
            }
        });
    }).on('error', function (err) {
        console.log("Get Tasks Error: " + err);

        if (timeout) {
            console.log("Sleeping " + timeout + " for Task Execution...");

            setTimeout(function () {
                getTasks(timeout);
            }, timeout);
        } else {
            console.log("Task Execution Complete");
        }
    }).end();
}

/**
 * Get Tasks - Retrieves a script from the API server (via several potential
 *             API routes such as /files, /templates, or static files)
 * @private
 * @param downloadUrl
 * @param cb
 */
function getFile(downloadUrl, cb) {
    var urlObj = url.parse(downloadUrl);
    http.request(urlObj, function (res) {
        var filename = path.basename(urlObj.pathname);
        var stream = fs.createWriteStream(filename);

        res.on('end', function () {
            stream.end(function() {
                // Close to a noop on windows, just flips the R/W bit
                fs.chmod(filename, "0555", function(error) {
                    if (error) {
                        cb(error);
                    } else {
                        cb(null);
                    }
                });
            });
        });

        res.on('error', function (error) {
            stream.end();
            cb(error);
        });

        res.pipe(stream);

    }).on('error', function (error) {
        cb(error);
    }).end();
}

/**
 * Check valid accepted response code - check whether the code is an array of number
 * @private
 * @param code
 */
function checkValidAcceptCode(code) {
    if (!(code instanceof Array)) {
        return false;
    }

    return code.every(function(item) {
        if (typeof item !== 'number') {
            return false;
        }
        return true;
    });
}

getTasks(5000);
