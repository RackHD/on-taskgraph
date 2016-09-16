// Copyright 2015, EMC, Inc.

'use strict';

require('es6-shim');

var di = require('di'),
    ejs = require('ejs');

module.exports = CommonApiPresenterFactory;

di.annotate(CommonApiPresenterFactory, new di.Provide('common-api-presenter'));
di.annotate(CommonApiPresenterFactory,
    new di.Inject(
        'Constants',
        'Services.Configuration',
        'Logger',
        'Promise',
        'Services.Lookup',
        'Profiles',
        'Templates',
        '_',
        'Services.Environment',
        'Protocol.Task'
    )
);

/**
 * CommonApiPresenterFactory provides the presenter factory function.
 * @private
 * @param  {configuration} configuration  NConf Configuration Object.
 * @param  {logger} logger Logger Service Object.
 * @param {LookupService} lookupService Instance of the LookupService
 * @return {function}        presenter factory function.
 */
function CommonApiPresenterFactory(
    constants,
    configuration,
    Logger,
    Promise,
    lookupService,
    profiles,
    templates,
    _,
    Env,
    taskProtocol
) {
    var logger = Logger.initialize(CommonApiPresenterFactory);

    /**
     * CommonApiPresenter converts fulfilled promises into their proper
     * ExpressJS responses.
     * @param {Request} req Express Request Object.
     * @param {Response} res Express Response Object.
     * @constructor
     */
    function CommonApiPresenter (req, res) {
        this.req = req;
        this.res = res;
    }

    /**
     * render
     * @param  {Promise} promise A promise which is fulfilled with Javascript
     * Objects to render as JSON.
     * @param  {Integer} status  Optional HTTP status code.
     */
    CommonApiPresenter.prototype.render = function (promise, status) {
        var self = this;

        status = status || 200;

        return Promise.resolve(promise).then(function (result) {
            if (result === undefined || result === null) {
                self.renderNotFound();
            } else {
                self.res.status(status).json(result);
            }
        })
        .catch(function (err) {
            self.renderError(err);
        });
    };

    CommonApiPresenter.prototype.renderPlain = function (promise, status) {
        var self = this;

        status = status || 200;

        return Promise.resolve(promise).then(function (result) {
            if (result === undefined || result === null) {
                self.renderNotFound();
            } else {
                self.res.status(status).send(result);
            }
        })
        .catch(function (err) {
            self.renderError(err);
        });
    };

    /**
     * renderError
     * @param  {Error|String} error An error object or string representing
     * the error to render.
     */
    CommonApiPresenter.prototype.renderError = function (error, options, status) {
        status = status || error.status || 500;

        logger.error(error.message, {
            error: error,
            path: this.req.path
        });

        this.res.status(status).json(error);
    };

    /**
     * renderNotFound
     */
    CommonApiPresenter.prototype.renderNotFound = function () {
        this.res.status(404).json({ error: 'Not Found'});
    };

    /**
     * renderTooBusy
     */
    CommonApiPresenter.prototype.renderTooBusy = function() {
        this.res.status(503).json({ error: 'Too Busy'});
    };

    /**
     * renderTemplate
     * @param  {string} template The name of the desired template.
     * to render.
     * @param  {Object} [options] An optional object to use for rendering via
     * the EJS renderer.
     * @param  {Integer} [status]  An optional HTTP status code.
     */
    CommonApiPresenter.prototype.renderTemplate = function (name, options, status, graphContext) {
        var self = this;

        options = options || {};
        status = status || 200;
        var scope = self.res.locals.scope;

        var promises = [
            self._buildContext(graphContext),
            templates.get(name, scope),
        ];

        Promise.all(promises).spread(function (localOptions, template) {
            var output;

            options = _.merge({}, options, localOptions);

            try {
                output = ejs.render(template.contents, options);
            } catch (err) {
                return self.renderError(err, options);
            }

            self.res.status(status).send(output);
        })
        .catch(function (err) {
            self.renderError(err);
        });
    };

    /**
     * renderProfile
     * @param  {string} profile The name of the desired profile.
     * to render.
     * @param  {Object} options An optional object to use for rendering via
     * the EJS renderer.
     * @param  {Integer} status  An optional HTTP status code.
     */
    CommonApiPresenter.prototype.renderProfile = function (profile, options, status, graphContext) {
        var self = this;
        var scope = self.res.locals.scope;

        options = options || {};
        status = status || 200;

        var promises = [
            self._buildContext(graphContext, options.ignoreLookup),
            profiles.get(profile, true, scope)
        ];

        if (profile.endsWith('.ipxe')) {
            promises.push(profiles.get('boilerplate.ipxe', true, scope));
        }

        Promise.all(promises).spread(
            function (localOptions, contents, boilerPlate) {
                var output = null;

                options = _.merge({}, options, localOptions);
                try {
                    // Render the requested profile + options. Don't stringify undefined.
                    output = ejs.render((boilerPlate || '') + contents, options);
                } catch (err) {
                    // Render error we'll try to render the error profile + options.
                    try {
                        output = ejs.render(
                            boilerPlate, // Don't stringify undefined
                            _.merge(options, { error: err.message })
                        );
                    } catch (error) {
                        // If we failed to render the error then we've got larger problems.

                        logger.error('Unable to render error template.', {
                            macaddress: options.macaddress,
                            error: error
                        });

                        return Promise.reject(error);
                    }
                }

                self.res.status(status).send(output);
            }
        )
        .catch(function (err) {
            self.renderError(err);
        });
    };

    CommonApiPresenter.prototype._buildContext = function(graphContext, ignoreLookup) {
        var self = this;
        var scope = self.res.locals.scope;
        var config = CommonApiPresenter.configCache;
        var apiServerAddress = self.req.get(constants.HttpHeaders.ApiProxyIp) ||
                                                      config.apiServerAddress ||
                                                      '10.1.1.1';
        var apiServerPort = self.req.get(constants.HttpHeaders.ApiProxyPort) ||
                                                        config.apiServerPort ||
                                                        80;
        var serverUri = 'http://' + apiServerAddress + ':' + apiServerPort;
        var baseUri = serverUri + '/api/current';

        graphContext = graphContext || {};

        return Promise.props({
            server: apiServerAddress,
            port: apiServerPort,
            ipaddress: self.res.locals.ipAddress,
            netmask: config.dhcpSubnetMask || '255.255.255.0',
            gateway: config.dhcpGateway || '10.1.1.1',
            macaddress: ignoreLookup ?
                '' : lookupService.ipAddressToMacAddress(self.res.locals.ipAddress),
            sku: Env.get('config', {}, [ scope[0] ]),
            env: Env.get('config', {}, scope),
            // Build structure that mimics the task renderContext
            api: {
                server: serverUri,
                base: baseUri,
                templates: baseUri + '/templates',
                profiles: baseUri + '/profiles',
                lookups: baseUri + '/lookups',
                files: baseUri + '/files',
                nodes: baseUri + '/nodes'
            },
            context: graphContext,
            nodeId: graphContext.target
        });
    };

    presenter.use = function serializer(name, func) {
        if (presenter._serializers.has(name)) {
            throw new Error('Serializer for ' + name + ' already registered');
        }
        presenter._serializers.set(name, func);
    };

    // Map() comes from es6-shim
    presenter._serializers = new Map();  /* jshint ignore: line */

    presenter.serialize = function serialize(value, options) {
        if (typeof options === 'string') {
            options = {
                serializer: options
            };
        } else if (!options) {
            options = {};
        }
        return Promise.resolve(value).then(function (value) {
            var serializer = null;

            if (options.serializer) {
                serializer = presenter._serializers.get(options.serializer);
            } else if (value && value.constructor) {
                serializer = presenter._serializers.get(value.constructor.name);
            }
            if (serializer) {
                return serializer(value, options);
            }
            return value;
        });
    };

    presenter.middleware = function presenterMiddleware(callback, options) {
        options = options || {};

        return function present(req, res, next) {
            var value;
            if (typeof callback === 'function') {
                try {
                    value = callback(req, res, next);
                } catch (err) {
                    return presenter(req, res).render(Promise.reject(err));
                }
            } else {
                value = callback;
            }

            return Promise.resolve(value).then(function (result) {
                return presenter.serialize(result, {
                    serializer: (typeof options === 'string') ? options : options.serializer,
                    version: options.version || req.headers[constants.API_VERSION_HEADER]
                });
            }).then(function (result) {
                return presenter(req, res).render(result, options.success || res.statusCode);
            }).catch(function (err) {
                return presenter(req, res).render(Promise.reject(err));
            });
        };
    };

    // Expose for test
    presenter.CommonApiPresenter = CommonApiPresenter;

    /**
     * presenter factory method.
     * @param  {Request} req Express Request Object.
     * @param  {Response} res Express Response Object.
     * @return {CommonApiPresenter}     CommonApiPresenter
     */
    function presenter (req, res) {
        // NOTE: getAll() has turned out to be a perf bottleneck, taking up to 40ms in
        // some cases. Until we make configuration updates dynamic, just cache this
        // at startup to avoid performance issues.
        presenter.CommonApiPresenter.configCache = configuration.getAll();

        return new presenter.CommonApiPresenter(req, res);
    }

    return presenter;
}
