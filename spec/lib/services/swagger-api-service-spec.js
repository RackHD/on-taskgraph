// Copyright 2016, EMC, Inc.
/* jshint node:true */

'use strict';

describe('Services.Http.Swagger', function() {
    var di = require('di');
    var core = require('on-core')(di, __dirname);
    var swaggerService;
    var Promise;
    var views;
    function MockSerializable() {}
    function MockSchemaService() {}
    var mockWaterlineService = {
        test: {}
    };

    before('inject swagger service', function() {
        helper.setupInjector(_.flattenDeep([
                helper.requireGlob('/lib/services/*.js'),
                helper.requireGlob('/api/rest/view/*.js'),
                core.workflowInjectables,
                core.injectables,
                helper.di.simpleWrapper(MockSerializable, 'Mock.Serializable'),
                helper.di.simpleWrapper(new MockSchemaService(), 'Http.Api.Services.Schema'),
                helper.di.simpleWrapper(mockWaterlineService, 'Services.Waterline')
            ])
        );

        swaggerService = helper.injector.get('Http.Services.Swagger');
        views = helper.injector.get('Views');
        Promise = helper.injector.get('Promise');
        this.sandbox = sinon.sandbox.create();
    });

    describe('controller()', function() {
        var mockNext;
        var mockController;
        var controller;

        beforeEach(function() {
            mockNext = sinon.stub();
            mockController = sinon.stub();
            controller = swaggerService.controller(mockController);
        });

        it('should call controller callback', function() {
            var req = {
                swagger: {
                    params: {
                        sort: {
                        }
                    }
                },
                query: {}
            };
            var res = {
                headersSent: false
            };
            var mockData = {data: 'mock data'};

            expect(controller).to.be.a('function');
            mockController.resolves(mockData);
            return controller(req, res, mockNext).then(function() {
                expect(res.body).to.equal(mockData);
                expect(mockNext).to.be.called.once;
            });
        });

        it('should process options', function() {
            var req = {
                swagger: {
                    params: {
                        sort: {
                        }
                    }
                },
                query: {}
            };

            var res = {
                headersSent: false
            };
            var mockData = {data: 'mock data'};
            var optController = swaggerService.controller({success: 201}, mockController);

            expect(optController).to.be.a('function');
            mockController.resolves(mockData);
            return optController(req, res, mockNext).then(function() {
                expect(res.body).to.equal(mockData);
                expect(mockNext).to.be.called.once;
                expect(req.swagger.options).to.have.property('success')
                    .and.to.equal(201);
            });
        });

        it('should process query', function() {
            var req = {
                query: {},
                swagger: {
                    params: {
                        sort: {
                        },
                        firstName: {
                            parameterObject: {
                                in: 'query',
                                type: 'string',
                                definition: { name: 'firstName' }
                            },
                            value: 'Rack'
                        },
                        lastName: {
                            parameterObject: {
                                in: 'query',
                                type: 'string',
                                definition: { name: 'lastName' }
                            },
                            value: 'HD'
                        },
                        undefinedName: {
                            parameterObject: {
                                in: 'query',
                                type: 'string',
                                definition: { name: 'undefinedName' }
                            },
                            value: undefined
                        },
                        inBody: {
                            parameterObject: {
                                in: 'body',
                                type: 'string',
                            },
                            value: 'not a query'
                        }
                    }
                }
            };
            var res = {
                headersSent: false
            };
            var mockData = {data: 'mock data'};
            var optController = swaggerService.controller(mockController);

            expect(optController).to.be.a('function');
            mockController.resolves(mockData);
            return optController(req, res, mockNext).then(function() {
                expect(res.body).to.equal(mockData);
                expect(mockNext).to.be.called.once;
                expect(req.swagger.query).to.have.property('firstName')
                    .and.to.equal('Rack');
                expect(req.swagger.query).to.have.property('lastName')
                    .and.to.equal('HD');
                expect(req.swagger.query).not.to.have.property('inBody');
                expect(req.swagger.query).not.to.have.property('undefinedName');
            });
        });

        it('should process sort query', function() {
            var req = {
                query:{
                    sort:"id"
                },
                swagger: {
                    params: {
                        sort: {
                            raw: "id"
                        }
                    }
                }
            };
            var res = {
                headersSent: false
            };
            var mockData = [
                {
                    id: '1234',
                    name: 'dummy'
                },
                {
                    id: '5679',
                    name: 'dummy2'
                }];
            var optController = swaggerService.controller(mockController);

            expect(optController).to.be.a('function');
            mockController.resolves(mockData);
            return optController(req, res, mockNext).then(function() {
                expect(req.swagger.params.sort).to.have.property('raw');
                expect(res.body).to.deep.equal(mockData);
                expect(mockNext).to.be.called.once;

            });
        });

        it('should not process sort function, when not present', function() {
            var req = {
                query:{
                    id:"1234"
                },
                swagger: {
                    params: {
                        sort: {
                        }
                    }
                }
            };
            var res = {
                headersSent: false
            };
            var mockData = [
                {
                    id: '1234',
                    name: 'dummy'
                }];
            var optController = swaggerService.controller(mockController);

            expect(optController).to.be.a('function');
            mockController.resolves(mockData);
            return optController(req, res, mockNext).then(function() {
                expect(res.body).to.deep.equal(mockData);
                expect(mockNext).to.be.called.once;

            });
        });

        it('should not call next after sending headers', function() {
            var req = {
                swagger: {
                    params: {
                        sort: {
                        }
                    }
                },
                query: {}
            };

            var res = {
                headersSent: true
            };
            var mockData = {data: 'mock data'};

            expect(controller).to.be.a('function');
            mockController.resolves(mockData);
            return controller(req, res, mockNext).then(function() {
                expect(mockController).to.be.called.once;
                expect(mockNext).not.to.be.called;
            });
        });

        it('should call next if an error occurs', function() {
            var req = {
                swagger: {
                    params: {
                        sort: {
                        }
                    }
                },
                query: {}
            };

            var res = {
                headersSent: false
            };
            var mockError = new Error('mock error');

            expect(controller).to.be.a('function');
            mockController.rejects(mockError);
            return controller(req, res, mockNext).then(function() {
                expect(mockController).to.be.called.once;
                expect(mockNext).to.be.calledWith(mockError);
            });
        });
    });

    describe('serializer()', function() {
        var mockNext;
        var serializer;

        beforeEach(function() {
            // Create mock serializable.
            MockSerializable.prototype.serialize = sinon.stub();
            MockSerializable.prototype.deserialize = sinon.stub();
            MockSerializable.prototype.validateAsModel = sinon.stub();
            MockSerializable.prototype.validatePartial = sinon.stub();
            MockSerializable.prototype.validate = sinon.stub();

            mockNext = sinon.stub();
            serializer = swaggerService.serializer('Mock.Serializable');
        });

        it('should serialize a scalar', function() {
            var mockData = {
                data: 'some data'
            };
            var req = {};
            var res = {
                body: mockData
            };
            MockSerializable.prototype.serialize.resolves(mockData);
            MockSerializable.prototype.validateAsModel.resolves(mockData);

            expect(serializer).to.be.a('function');
            return serializer(req, res, mockNext).then(function() {
                expect(res.body).to.equal(mockData);
                expect(mockNext).to.be.called.once;
            });
        });

        it('should serialize an array', function() {
            var mockData = {
                data: 'some data'
            };
            var req = {};
            var res = {
                body: [ mockData, mockData ]
            };

            MockSerializable.prototype.serialize.resolves(mockData);
            MockSerializable.prototype.validateAsModel.resolves(mockData);

            expect(serializer).to.be.a('function');
            return serializer(req, res, mockNext).then(function() {
                expect(res.body).to.deep.equal([ mockData, mockData ]);
                expect(mockNext).to.be.called.once;
            });
        });

        it('should call next if serializer error occurs', function() {
            var mockData = {
                data: 'some data'
            };
            var req = {};
            var res = {
                body: mockData
            };
            var mockError = new Error('serializer error');
            MockSerializable.prototype.serialize.rejects(mockError);

            expect(serializer).to.be.a('function');
            return serializer(req, res, mockNext).then(function() {
                expect(mockNext).to.be.calledWith(mockError);
            });
        });

        it('should call next if validation error occurs', function() {
            var mockData = {
                data: 'some data'
            };
            var req = {};
            var res = {
                body: mockData
            };
            var mockError = new Error('serializer error');
            MockSerializable.prototype.serialize.resolves(mockData);
            MockSerializable.prototype.validateAsModel.rejects(mockError);

            expect(serializer).to.be.a('function');
            return serializer(req, res, mockNext).then(function() {
                expect(mockNext).to.be.calledWith(mockError);
            });
        });
    });

    describe('deserializer()', function() {
        var mockNext;
        var deserializer;

        beforeEach(function() {
            // Create mock serializable.
            MockSerializable.prototype.serialize = sinon.stub();
            MockSerializable.prototype.deserialize = sinon.stub();
            MockSerializable.prototype.validateAsModel = sinon.stub();
            MockSerializable.prototype.validatePartial = sinon.stub();
            MockSerializable.prototype.validate = sinon.stub();

            mockNext = sinon.stub();
            deserializer = swaggerService.deserializer('Mock.Serializable');
        });

        it('should deserialize scalar', function() {
            var mockData = {
                data: 'some data'
            };
            var req = {
                body: mockData
            };
            var res = {};

            expect(deserializer).to.be.a('function');
            MockSerializable.prototype.validate.resolves(mockData);
            MockSerializable.prototype.deserialize.resolves(mockData);
            return deserializer(req, res, mockNext).then(function() {
                expect(req.body).to.equal(mockData);
                expect(mockNext).to.be.called.once;
            });
        });

        it('should deserialize array', function() {
            var mockData = {
                data: 'some data'
            };
            var mockDataArray = [ mockData, mockData ];
            var req = {
                body: mockDataArray
            };
            var res = {};

            expect(deserializer).to.be.a('function');
            MockSerializable.prototype.validate.resolves(mockDataArray);
            MockSerializable.prototype.deserialize.resolves(mockDataArray);
            return deserializer(req, res, mockNext).then(function() {
                expect(req.body).to.equal(mockDataArray);
                expect(mockNext).to.be.called.once;
            });
        });

        it('should call next if validation error occurs', function() {
            var mockError = {
                message: 'validation error'
            };
            var mockData = {
                data: 'some data'
            };
            var req = {
                body: mockData
            };
            var res = {};
            mockError = new Error('deserializer error');

            expect(deserializer).to.be.a('function');
            MockSerializable.prototype.validate.rejects(mockError);
            return deserializer(req, res, mockNext).then(function() {
                expect(mockNext).to.be.calledWith(mockError);
            });
        });

        it('should call next if deserialize error occurs', function() {
            var mockError = {
                message: 'validation error'
            };
            var mockData = {
                data: 'some data'
            };
            var req = {
                body: mockData
            };
            var res = {};
            mockError = new Error('deserializer error');

            expect(deserializer).to.be.a('function');
            MockSerializable.prototype.validate.resolves(mockData);
            MockSerializable.prototype.deserialize.rejects(mockError);
            return deserializer(req, res, mockNext).then(function() {
                expect(mockNext).to.be.calledWith(mockError);
            });
        });
    });

    describe('validator()', function() {
        var mockNext;
        var validator;
        var mockData = { name: "123" };

        beforeEach(function() {
            mockNext = sinon.stub();
            MockSchemaService.prototype.addNamespace = sinon.stub();
            MockSchemaService.prototype.addNamespace.resolves('foo');
            MockSchemaService.prototype.validate = sinon.stub();
            validator = swaggerService.validator();
            expect(validator).to.be.a('function');
        });

        it('should skip validation if schema is undefined', function() {
            MockSchemaService.prototype.validate.resolves([]);
            validator(undefined, mockData, function() {
                expect(MockSchemaService.prototype.validate).not.to.be.called;
            });
        });

        it('should validate an object', function() {
            MockSchemaService.prototype.validate.resolves([]);
            validator(mockData, mockData, function() {
                expect(MockSchemaService.prototype.validate).to.be.called;
            });
        });

        it('should return error on validation error', function() {
            MockSchemaService.prototype.validate.resolves({error: "error message"});
            validator(mockData, mockData, function(err) {
                expect(err.message).to.equal('error message');
            });
        });
    });

    describe('renderer()', function() {
        var mockNext;
        var renderer;
        var send;
        var status;
        var set;
        var res;
        var req;

        beforeEach(function() {
            renderer = swaggerService.renderer;

            // Initialize stubs
            mockNext = sinon.stub();
            send = sinon.stub();
            status = sinon.stub();
            set = sinon.stub();

            // Mock request and response objects
            res = {
                headersSent: false,
                body: {},
                send: send,
                status: status,
                set: set,
                locals: "dummy"
            };
            req = {
                swagger: {
                    options: {},
                    operation:{
                        api:{
                            basePath: "nothing"
                        }
                    },
                    swaggerObject: {
                        basePath: "nothing"
                    }
                }
            };

            // Monkey-patch sandbox stubs into view.get
            views.get = this.sandbox.stub();
            views.load = this.sandbox.stub().resolves();
            views.get.withArgs('collection.2.0.json').resolves({
                contents:
                    "[<% collection.forEach(function(element, i, arr) { %>" +
                    "<%- element %><%= ( arr.length > 0 && i < arr.length-1  ) ? ',' : '' %>" +
                    "<%  }); %>]"
            });
            views.get.withArgs('test.json').resolves({contents: '{ "message": "<%=message%>" }'});
            views.get.resolves();
        });

        afterEach(function() {
            this.sandbox.restore();
            mockNext.reset();
            status.reset();
            send.reset();
            set.reset();
        });

        it('should assert if headers sent', function() {
            res.headersSent = true;
            return renderer(req, res, 'foo', mockNext)
            .then(function() {
                expect(status).not.to.be.called;
                expect(mockNext).to.be.calledOnce;
            },
            function(err) {
                expect(err).to.be.undefined;
            });
        });

        it('should skip rendering if view is undefined', function() {
            res.body = { message: "foo" };
            return renderer(req, res, undefined, mockNext)
            .then(function() {
                expect(status).to.be.calledWith(200);
                expect(send).to.be.calledWith({ message: "foo" });
            },
            function(err) {
                expect(err).to.be.undefined;
            });
        });

        it('should render an object', function() {
            res.body = { message: "foo" };
            return renderer(req, res, 'test.json', mockNext)
            .then(function() {
                expect(status).to.be.calledWith(200);
                expect(set).to.be.calledWith('Content-Type', 'application/json');
                expect(send).to.be.calledWith('{"message":"foo"}');
            },
            function(err) {
                expect(err).to.be.undefined;
            });
        });

        it('should render a collection of objects()', function() {
            res.body = [{message: "foo"}, {message: "bar"}];
            return renderer(req, res, 'test.json', mockNext)
            .then(function() {
                expect(status).to.be.calledWith(200);
                expect(set).to.be.calledWith('Content-Type', 'application/json');
                expect(send).to.be.calledWith('[{"message":"foo"},{"message":"bar"}]');
            },
            function(err) {
                expect(err).to.be.undefined;
            });
        });

        it('should send 204 on empty', function() {
            req.swagger.options.send204OnEmpty = true;
            return renderer(req, res, 'foo', mockNext)
            .then(function() {
                expect(status).to.be.calledWith(204);
            },
            function(err) {
                expect(err).to.be.undefined;
            });
        });

        it('should throw 500 on invalid template', function() {
            res.body = { message: "foo" };
            return renderer(req, res, 'foo', mockNext)
            .then(function() {
                expect(mockNext).to.be.calledWithMatch({status: 500});
            },
            function(err) {
                expect(err).to.be.undefined;
            });
        });

        it('should throw 500 on render error', function() {
            res.body = { message: "foo" };
            views.render = this.sandbox.stub().rejects(new Error());
            return renderer(req, res, 'foo', mockNext)
            .then(function() {
                expect(mockNext).to.be.calledWithMatch({status: 500});
            },
            function(err) {
                expect(err).to.be.undefined;
            });
        });
    });

    describe('addLinkHeader()', function() {
        var addLinksHeader;

        var res = {
            links: sinon.stub()
        };

        before(function() {
            addLinksHeader = swaggerService.addLinksHeader;
        });

        beforeEach(function() {
            res.links.reset();
        });

        it('should not add links without $skip or $top', function() {
            var req = {
                url: '/api/2.0/things',
                swagger: { query: { } }
            };

            mockWaterlineService.test.count = sinon.stub().resolves(10);
            return addLinksHeader(req, res, 'test')
            .then(function() {
                expect(res.links).not.to.be.called;
            });
        });

        it('should not add links if object count is less than $top', function() {
            var req = {
                url: '/api/2.0/things?$top=10',
                swagger: { query: { $top: 10} }
            };

            mockWaterlineService.test.count = sinon.stub().resolves(8);
            return addLinksHeader(req, res, 'test')
            .then(function() {
                expect(res.links).not.to.be.called;
            });
        });

        it('should not add links if object count is equal to $top', function() {
            var req = {
                url: '/api/2.0/things?$top=10',
                swagger: { query: { $top: 10} }
            };

            mockWaterlineService.test.count = sinon.stub().resolves(10);
            return addLinksHeader(req, res, 'test')
            .then(function() {
                expect(res.links).not.to.be.called;
            });
        });

        it('should add links with $top', function() {
            var req = {
                url: '/api/2.0/things?$top=10',
                swagger: { query: { $top: 10} }
            };
            var expected = {
                first: '/api/2.0/things?$skip=0&$top=10',
                next: '/api/2.0/things?$skip=10&$top=10',
                last: '/api/2.0/things?$skip=30&$top=10'
            };

            mockWaterlineService.test.count = sinon.stub().resolves(40);
            return addLinksHeader(req, res, 'test')
            .then(function() {
                expect(res.links).to.be.calledWith(expected);
            });
        });

        it('should add links with $skip and $top', function() {
            var req = {
                url: '/api/2.0/things?$top=10',
                swagger: { query: { $skip: 8, $top: 9} }
            };
            var expected = {
                first: '/api/2.0/things?$skip=0&$top=8',
                next: '/api/2.0/things?$skip=17&$top=9',
                prev: '/api/2.0/things?$skip=0&$top=8',
                last: '/api/2.0/things?$skip=36&$top=9'
            };

            mockWaterlineService.test.count = sinon.stub().resolves(37);
            return addLinksHeader(req, res, 'test')
            .then(function() {
                expect(res.links).to.be.calledWith(expected);
            });
        });

        it('should add links with $skip', function() {
            var req = {
                url: '/api/2.0/things?$skip=10',
                swagger: { query: { $skip: 10} }
            };
            var expected = {
                first: '/api/2.0/things?$skip=0&$top=10',
                prev: '/api/2.0/things?$skip=0&$top=10',
                last: '/api/2.0/things?$skip=10&$top=30'
            };

            mockWaterlineService.test.count = sinon.stub().resolves(40);
            return addLinksHeader(req, res, 'test')
            .then(function() {
                expect(res.links).to.be.calledWith(expected);
            });
        });

        it('should add links with $skip and $top', function() {
            var req = {
                url: '/api/2.0/things?$top=10',
                swagger: { query: { $skip: 20, $top: 10} }
            };
            var expected = {
                first: '/api/2.0/things?$skip=0&$top=10',
                next: '/api/2.0/things?$skip=30&$top=10',
                prev: '/api/2.0/things?$skip=10&$top=10',
                last: '/api/2.0/things?$skip=30&$top=10'
            };

            mockWaterlineService.test.count = sinon.stub().resolves(40);
            return addLinksHeader(req, res, 'test')
            .then(function() {
                expect(res.links).to.be.calledWith(expected);
            });
        });

        it('should add links with $skip and $top', function() {
            var req = {
                url: '/api/2.0/things?$top=10',
                swagger: { query: { $skip: 5, $top: 10} }
            };
            var expected = {
                first: '/api/2.0/things?$skip=0&$top=5',
                next: '/api/2.0/things?$skip=15&$top=10',
                prev: '/api/2.0/things?$skip=0&$top=5',
                last: '/api/2.0/things?$skip=30&$top=10'
            };

            mockWaterlineService.test.count = sinon.stub().resolves(40);
            return addLinksHeader(req, res, 'test')
            .then(function() {
                expect(res.links).to.be.calledWith(expected);
            });
        });

        it('should add links with $skip and $top', function() {
            var req = {
                url: '/api/2.0/things?$top=10',
                swagger: { query: { $skip: 0, $top: 8} }
            };
            var expected = {
                first: '/api/2.0/things?$skip=0&$top=8',
                next: '/api/2.0/things?$skip=8&$top=8',
                last: '/api/2.0/things?$skip=32&$top=8'
            };

            mockWaterlineService.test.count = sinon.stub().resolves(37);
            return addLinksHeader(req, res, 'test')
            .then(function() {
                expect(res.links).to.be.calledWith(expected);
            });
        });

        it('should add links with $skip and $top', function() {
            var req = {
                url: '/api/2.0/things?$top=10',
                swagger: { query: { $skip: 30, $top: 10} }
            };
            var expected = {
                first: '/api/2.0/things?$skip=0&$top=10',
                prev: '/api/2.0/things?$skip=20&$top=10',
                last: '/api/2.0/things?$skip=30&$top=10'
            };

            mockWaterlineService.test.count = sinon.stub().resolves(40);
            return addLinksHeader(req, res, 'test')
            .then(function() {
                expect(res.links).to.be.calledWith(expected);
            });
        });
    });
});
