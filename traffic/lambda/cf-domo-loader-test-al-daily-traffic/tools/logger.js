'use strict';

exports.info = function () {
    if (process.env.log_level == 'info') {
        console.log.apply(null, arguments);
    }
}

exports.error = function () {
    console.log.apply(null, arguments);
}

exports.log =  function () {
    if (process.env.log_level == 'info') {
        console.log.apply(null, arguments);
    }
}
