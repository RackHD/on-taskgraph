'use strict';

global.chai = require('chai');
global.chai.use(require("chai-as-promised"));
global.chai.use(require("sinon-chai"));
global.expect = chai.expect;
global.should = chai.should();
global.di = require('di');
