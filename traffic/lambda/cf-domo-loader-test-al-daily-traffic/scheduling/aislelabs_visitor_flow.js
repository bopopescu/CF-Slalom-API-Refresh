'use strict';

const handlers = require('../handlers/main.js');
const Promise = require('bluebird');
const _ = require('lodash');
const moment = require('moment-timezone');
const helper = require('../tools/aislelabs-helper.js');
const log = require('../tools/logger.js');
const config = require('config');
const stage = process.env.stage;
const table_templates = require('../management/templates.js')[stage];

const tables = [{ id:process.env.bouncedstreamid, type:'B', tableInfo: table_templates.visitor_bounced_stream },
                { id:process.env.newstreamid, type:'N', tableInfo: table_templates.visitor_new_stream },
                { id:process.env.totalstreamid, type:'S', tableInfo: table_templates.visitor_total_stream }];


function processDay(currentDay, callback, recordAccum, isBackfill, endBackfill) {
    let records = [];

    if (recordAccum) {
      records = recordAccum;
    }

    if (!endBackfill) {
      for(let t=0; t < tables.length; t++) {
        _.each(config.aislelabs.properties, (property) => {
            const startTime = moment(currentDay).tz(property.tz).startOf('day').
                              format('x')*1;
            const endTime = moment(currentDay).tz(property.tz).endOf('day').
                            format('x')*1;
            records.push(helper.getVisitorFlowRequest(startTime, endTime, 
                        property.tdid, 
                        tables[t].id, tables[t].type, tables[t].tableInfo));
          });
      }
    }

    if (!isBackfill || endBackfill) {
      log.log('processing backfill');
      handlers.doProcess(records, callback);
    }

    return records;
}

exports.get = (event, context, callback) => {
    log.log("Visitor flow request");
    if (event.queryStringParameters &&
        event.queryStringParameters.start &&
        event.queryStringParameters.end) {
        log.log("Processing backfilling");
        const currentDay = moment(event.queryStringParameters.start).hour(11);
        const lastDay = moment(event.queryStringParameters.end);
        let records = [];

        while (!currentDay.isSame(lastDay, 'day')) {
            records = processDay(currentDay, callback, records, true, false);
            currentDay.add(1, 'day');
        }
        processDay(currentDay, callback, records, true, true);
    } else {
        log.log("Processing current day only");
        const currentDay = moment().subtract(1, 'days').hour(11);
        processDay(currentDay, callback);
    }
};
