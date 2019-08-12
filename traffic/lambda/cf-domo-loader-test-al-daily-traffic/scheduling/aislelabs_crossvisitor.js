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


function processDay(momentDay, callback, recordAccum, isBackfill, endBackfill) {
    log.log("starting ProcessDay" );
    let records = [];

    if (recordAccum) {
      records = recordAccum;
    }

    if (!endBackfill) {
      let track = {};
      _.each(config.aislelabs.properties, (startProperty) => {
        _.each(config.aislelabs.properties, (endProperty) => {
              const startTime = moment(momentDay).tz(startProperty.tz)
                                .startOf('month').format('x') * 1;
              const endTime = moment(momentDay).tz(startProperty.tz)
                              .endOf('month').format('x') * 1;
              if (startProperty.tdid != endProperty.tdid 
                  && !track[`${startProperty.tdid} ${endProperty.tdid}`]) {
                  const ids = `${startProperty.tdid},${endProperty.tdid}`;
                  const template = helper.getCrossVisitorRequest(startTime, endTime, 
                                    ids, process.env.crossvisitorStreamId, 
                                    table_templates.crossvisitor_stream);
                  records.push(template);
                  track[`${startProperty.tdid} ${endProperty.tdid}`] = 1;
                  track[`${endProperty.tdid} ${startProperty.tdid}`] = 1;
              }
          });
      });
    }

    if (!isBackfill || endBackfill) {
      log.log('processing backfill');
      handlers.doProcess(records, callback);
    }

    return records;
}

exports.get = (event, context, callback) => {
    log.log("Crossvisitor request");
    if (event.queryStringParameters &&
        event.queryStringParameters.start &&
        event.queryStringParameters.end) {
        log.log("Processing backfilling");
        const current = moment(event.queryStringParameters.start);
        log.log("Current: " + current.toString());
        let records = [];
        // Go month to month
        while (!current.startOf('month').isSame(moment(event.queryStringParameters.end).startOf('month'))) {
            log.log("Entering the while");
            records = processDay(current, callback, records, true, false);
            current.add(1, 'month');
        }
        processDay(current, callback, records, true, true);
    } else {
        log.log("Processing current month only");
        const currentDay = moment().subtract(1, 'days').hour(11);
        processDay(currentDay, callback);
    }
};
