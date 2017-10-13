// Copyright © 2017 Dell Inc. or its subsidiaries. All Rights Reserved.

'use strict';

var di = require('di'),
    ejs = require('ejs');


module.exports = profileApiServiceFactory;
di.annotate(profileApiServiceFactory, new di.Provide('Http.Services.Api.Profiles'));
di.annotate(profileApiServiceFactory,
    new di.Inject(
        'Promise',
        'Http.Services.Api.Workflows',
        'Protocol.Task',
        'Protocol.Events',
        'Services.Waterline',
        'Services.Configuration',
        'Services.Lookup',
        'Logger',
        'Errors',
        '_',
        'Profiles',
        'Services.Environment',
        'Http.Services.Swagger',
        'Constants',
        'Assert'
    )
);
function profileApiServiceFactory(
    Promise,
    workflowApiService,
    taskProtocol,
    eventsProtocol,
    waterline,
    configFile,
    lookupService,
    Logger,
    Errors,
    _,
    profiles,
    Env,
    swaggerService,
    Constants,
    assert
) {

    var logger = Logger.initialize(profileApiServiceFactory);

    function ProfileApiService() {
    }

    // Helper to convert property kargs into an ipxe friendly string.
    ProfileApiService.prototype.convertProperties = function(properties) {
        properties = properties || {};

        if (properties.hasOwnProperty('kargs')) {
            // This a promotion of the kargs property
            // for DOS disks (or linux) for saving
            // the trouble of having to write a
            // bunch of code in the EJS template.
            if(typeof properties.kargs === 'object') {
                properties.kargs = _.map(
                    properties.kargs, function (value, key) {
                        return key + '=' + value;
                    }).join(' ');
            }
        } else {
            // Ensure kargs is set for rendering.
            properties.kargs = null;
        }

        return properties;
    };

    ProfileApiService.prototype.getMacs = function(macs) {
        return _.flattenDeep([macs]);
    };

    /**
     * Get macAddress in HTTP request
     * @param {Object} query      the query in HTTP request
     * @param {String} requestIp  the IP of the HTTP request
     * @return {Promise} Resolves to macAddress if found, otherwise undefined.
     */
    ProfileApiService.prototype.getMacAddressInRequest = function(query, requestIp) {
        assert.object(query);
        assert.string(requestIp);

        if (query.macs && query.ips) {
            var macAddresses = _.flattenDeep([query.macs]);
            var ipAddresses = _.flattenDeep([query.ips]);

            var index = _.findIndex(ipAddresses, function(ip) {
                return (ip && (ip === requestIp));
            });

            if(index >= 0 && macAddresses[index]) {
                return Promise.resolve(macAddresses[index]);
            }
        }

        return Promise.resolve();
    };

    ProfileApiService.prototype.setLookup = function(ipAddress, macAddress, proxyIp, proxyPort) {
        return lookupService.setIpAddress(ipAddress, macAddress)
        .then(function() {
            if (proxyIp) {
                var proxy = 'http://%s:%s'.format(proxyIp, proxyPort);
                return waterline.lookups.upsertProxyToMacAddress(proxy, macAddress);
            }
        });
    };

    ProfileApiService.prototype.getNode = function(macAddresses, options) {
        var self = this;
        return waterline.nodes.findByIdentifier(macAddresses)
            .then(function (node) {
                if (node) {
                    return node.discovered()
                        .then(function(discovered) {
                            if (!discovered) {
                                return taskProtocol.activeTaskExists(node.id)
                                    .then(function() {
                                        return node;
                                    })
                                    .catch(function() {
                                        return self.runDiscovery(node, options);
                                    });
                            } else {
                                // We only count a node as having been discovered if
                                // a node document exists AND it has any catalogs
                                // associated with it
                                return node;
                            }

                        });
                } else {
                    return self.createNodeAndRunDiscovery(macAddresses, options);
                }
            });
    };

    ProfileApiService.prototype.runDiscovery = function(node, options) {
        var self = this;
        var configuration;


        if (node.type === 'switch') {
            configuration = self.getSwitchDiscoveryConfiguration(node, options.switchVendor);
        } else {
            var rebootCode = 1; //ipmi power cycle
            var setObm = configFile.get('autoCreateObm', 'false');
            var skipReboot = configFile.get('skipResetPostDiscovery', 'false');
            if (skipReboot === 'true') {
                rebootCode = 127; // skip reset but terminate bootstrap
            }
            if (setObm === 'true') {
                skipReboot = 'true';
            } else {
                skipReboot = 'false';
            }
            var skipPollers = configFile.get('skipPollersCreation', 'false');
            configuration = {
                name: configFile.get('discoveryGraph', 'Graph.SKU.Discovery'),
                options: {
                    defaults: {
                        graphOptions: {
                            target: node.id,
                            'skip-reboot-post-discovery' : {
                                skipReboot: skipReboot
                            },
                            'shell-reboot': {
                                rebootCode: rebootCode
                            }
                        },
                        nodeId: node.id
                    },
                    'skip-pollers': {
                        skipPollersCreation: skipPollers
                    },
                    'obm-option' : {
                        autoCreateObm: setObm
                    }
                }
            };
        }

        // If there is an api proxy add it to the context
        lookupService.nodeIdToProxy(node.id).then( function(proxy) {
            if(proxy) {
                configuration.context = {proxy: proxy};
            }
        });

        // The nested workflow holds the lock against the nodeId in this case,
        // so don't add it as a target to the outer workflow context
        return workflowApiService.createAndRunGraph(configuration, null)
            .then(function() {
                return self.waitForDiscoveryStart(node.id);
            })
            .then(function() {
                return node;
            });
    };

    ProfileApiService.prototype.getSwitchDiscoveryConfiguration = function(node, vendor) {
        var configuration = {
            name: 'Graph.SKU.Switch.Discovery.Active',
            options: {
                defaults: {
                    graphOptions: {
                        target: node.id
                    },
                    nodeId: node.id
                },
                'vendor-discovery-graph': {
                    graphName: null
                }
            }
        };

        vendor = vendor.toLowerCase();

        if (vendor === 'cisco') {
            configuration.options['vendor-discovery-graph'].graphName =
                'Graph.Switch.Discovery.Cisco.Poap';
        } else if (vendor === 'brocade') {
            configuration.options['vendor-discovery-graph'].graphName =
                'Graph.Switch.Discovery.Brocade.Ztp';
        } else if (vendor === 'arista') {
            configuration.options['vendor-discovery-graph'].graphName =
                'Graph.Switch.Discovery.Arista.Ztp';
        } else {
            throw new Errors.BadRequestError('Unknown switch vendor ' + vendor);
        }

        return configuration;
    };

    ProfileApiService.prototype.createNodeAndRunDiscovery = function(macAddresses, options) {
        var self = this;
        var node;
        return Promise.resolve().then(function() {
            return waterline.nodes.create({
                name: macAddresses.join(','),
                identifiers: macAddresses,
                type: options.type
            });
        }).tap(function(_node) {
            return eventsProtocol.publishNodeEvent(_node, 'added');
        }).then(function (_node) {
                node = _node;

                return Promise.resolve(macAddresses).each(function (macAddress) {
                    return waterline.lookups.upsertNodeToMacAddress(node.id, macAddress);
                });
            })
            .then(function () {
                // Setting newRecord to true allows us to
                // render the redirect again to avoid refresh
                // of the node document and race conditions with
                // the state machine changing states.
                node.newRecord = true;

                return self.runDiscovery(node, options);
            });
    };

    // Quick and dirty extra two retries for the discovery graph, as the
    // runTaskGraph promise gets resolved before the tasks themselves are
    // necessarily started up and subscribed to bus events.
    ProfileApiService.prototype.waitForDiscoveryStart = function(nodeId) {
        var retryRequestProperties = function(error) {
            if (error instanceof Errors.RequestTimedOutError) {
                return taskProtocol.requestProperties(nodeId);
            } else {
                throw error;
            }
        };

        return taskProtocol.requestProperties(nodeId)
            .catch(retryRequestProperties)
            .catch(retryRequestProperties);
    };

    ProfileApiService.prototype._handleProfileRenderError = function(errMsg, type, status) {
        var err = new Error("Error: " + errMsg);
        err.status = status || 500;
        throw err;
    };

    ProfileApiService.prototype.getProfileFromTaskOrNode = function(node) {
        var self = this;
        var defaultProfile;

        if (node.type === 'switch') {
            // Unlike for compute nodes, we don't need to or have the capability
            // of booting into a microkernel, so just send down the
            // python script right away, and start downloading
            // and executing tasks governed by the switch-specific
            // discovery workflow.
            defaultProfile = 'taskrunner.py';
        } else {
            defaultProfile = 'redirect.ipxe';
        }

        return workflowApiService.findActiveGraphForTarget(node.id)
            .then(function (taskgraphInstance) {
                if (taskgraphInstance) {
                    return taskProtocol.requestProfile(node.id)
                        .catch(function(err) {
                            if (node.type === 'switch') {
                                return null;
                            } else {
                                throw err;
                            }
                        })
                        .then(function(profile) {
                            return [profile, taskProtocol.requestProperties(node.id)];
                        })
                        .spread(function (profile, properties) {
                            var _options;
                            if (node.type === 'compute') {
                                _options = self.convertProperties(properties);
                            } else if (node.type === 'switch') {
                                var switchVendor;
                                if(taskgraphInstance.injectableName === "Graph.Switch.Discovery.Arista.Ztp"){
                                    switchVendor = "arista";
                                }else if(taskgraphInstance.injectableName === "Graph.Switch.Discovery.Brocade.Ztp"){
                                    switchVendor = "brocade";                                    
                                }else if(taskgraphInstance.injectableName === "Graph.Switch.Discovery.Cisco.Poap"){
                                    switchVendor = "cisco";
                                }
                                
                                _options = {
                                    identifier: node.id,
                                    switchVendor : switchVendor
                                };
                            }
                            return {
                                profile: profile || defaultProfile,
                                options: _options,
                                context: taskgraphInstance.context
                            };
                        })
                        .catch(function (e) {
                            logger.warning("Unable to retrieve workflow properties or profiles", {
                                error: e,
                                id: node.id,
                                taskgraphInstanceId: taskgraphInstance.instanceId
                            });
                            return self._handleProfileRenderError(
                                'Unable to retrieve workflow properties or profiles', node.type, 503);
                        });
                } else {
                    if (_.has(node, 'bootSettings')) {
                        if (_.has(node.bootSettings, 'options') &&
                            _.has(node.bootSettings, 'profile')) {
                            return {
                                profile: node.bootSettings.profile || 'redirect.ipxe',
                                options: node.bootSettings.options
                            };
                        } else {
                            return self._handleProfileRenderError(
                                'Unable to retrieve valid node bootSettings', node.type);
                        }
                    } else {
                        return {
                            profile: 'ipxe-info.ipxe',
                            options: { message:
                                'No active workflow and bootSettings, continue to boot' },
                            context: undefined
                        };
                    }
                }
            });
    };

    ProfileApiService.prototype.renderProfile = function (profile, req, res) {
        var scope = res.locals.scope;
        var options = profile.options || {};
        var graphContext = profile.context || {};

        var promises = [
            swaggerService.makeRenderableOptions(req, res, graphContext,
                profile.ignoreLookup),
            profiles.get(profile.profile, true, scope)
        ];

        if (profile.profile.endsWith('.ipxe')) {
            promises.push(profiles.get('boilerplate.ipxe', true, scope));
        }

        return Promise.all(promises).spread(
            function (localOptions, contents, boilerPlate) {
                options = _.merge({}, options, localOptions);
                // Render the requested profile + options. Don't stringify undefined.
                return ejs.render((boilerPlate || '') + contents, options);
            }
        );
    };

    ProfileApiService.prototype.getProfiles = function(req, query, res) {
        var self = this;
        var ipAddress = res.locals.ipAddress;
        return self.getMacAddressInRequest(query, ipAddress)
        .then(function(macAddress) {
            if(macAddress) {
                res.locals.macAddress = macAddress;
                var proxyIp = req.get(Constants.HttpHeaders.ApiProxyIp);
                var proxyPort = req.get(Constants.HttpHeaders.ApiProxyPort);
                return self.setLookup(ipAddress, macAddress, proxyIp, proxyPort);
            }
        })
        .then(function() {
            var macs = req.query.mac || req.query.macs;
            if (macs) {
                var macAddresses = self.getMacs(macs);
                var options = {
                    type: 'compute'
                };

                return self.getNode(macAddresses, options)
                    .then(function (node) {
                        return self.getProfileFromTaskOrNode(node, 'compute')
                            .then(function (render) {
                                return _.defaults(render, {
                                    ignoreLookup: res.locals.macAddress ? true : false
                                });
                            });
                    });
            } else {
                return { profile: 'redirect.ipxe', ignoreLookup: true };
            }
        })
        .catch(function (err) {
            if (!err.status) {
                throw new Errors.InternalServerError(err.message);
            } else {
                throw err;
            }
        });
    };

    ProfileApiService.prototype.getProfilesSwitchVendor = function(
        requestIp, vendor
    ) {
        var self = this;
        return waterline.lookups.findOneByTerm(requestIp)
            .then(function(record) {
                return record.macAddress;
            })
            .then(function(macAddress) {
                return self.getMacs(macAddress);
            })
            .then(function(macAddresses) {
                var options = {
                    type: 'switch',
                    switchVendor: vendor
                };
                return self.getNode(macAddresses, options);
            })
            .then(function(node) {
                return self.getProfileFromTaskOrNode(node, 'switch');
            })
            .catch(function (err) {
                throw err;
            });
    };

    ProfileApiService.prototype.postProfilesSwitchError = function(error) {
        logger.error('SWITCH ERROR DEBUG ', error);
    };

    return new ProfileApiService();
}