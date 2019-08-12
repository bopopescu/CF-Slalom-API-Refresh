const sinon = require ('sinon');
const chai = require ('chai');
const sinonChai = require ('sinon-chai');
const chaiAsPromised = require ('chai-as-promised');
const expect = chai.expect;
require ('chai').should ();

before (function () {
    chai.use (sinonChai);
    chai.use (chaiAsPromised);

    sinon.stub.returnsWithResolve = function (data) {
        return this.returns (Promise.resolve (data));
    };

    sinon.stub.returnsWithReject = function (error) {
        return this.returns (Promise.reject (error));
    };
});

beforeEach (function () {
    this.sandbox = sinon.sandbox.create ();
});

afterEach (function () {
    this.sandbox.restore ();
});
