'use strict';
const handlers = require('../handlers/main.js');
const _ = require('lodash');
const helper = require('../tools/meraki-helper.js');
const log = require('../tools/logger.js');
const config = require('config');
const stage = process.env.stage;
const moment = require('moment-timezone');
const table_templates = require('../management/templates.js')[stage];


exports.getDevices = (event, context, callback) => {
    let records = [];
    log.log({
        message: "Getting meraki devices"
    });

    _.each(config.meraki.networks, (network) => {
        const request = helper.getDevicesRequest(config.meraki.organization, network.id, 
                                                 process.env.merakiDevicesStreamId, 
                                                 table_templates.meraki_devices);
        records.push(request);
    });

    handlers.doProcess(records, callback);
};

exports.getDevicesStatus = (event, context, callback) => {
    log.log({
        message: "Getting meraki devices status"
    });
    const now = moment().format('YYYY_MM_DD_HH_mm');
    const filename = `deviceStatus_${now}.json`;
    handlers.doProcess([helper.getDevicesStatusRequest(config.meraki.organization,
                                                       process.env.merakiDevicesStatusStreamId,
                                                       table_templates.meraki_devices_status,
                                                       filename)], callback);
};