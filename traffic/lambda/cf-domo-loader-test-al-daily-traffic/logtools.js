'use strict';
const util = require('util');

exports.f = (obj) => {
    return util.format('%j', obj)
};
