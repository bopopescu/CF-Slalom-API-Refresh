'use strict';

const handlers = require('../handlers/main.js');
const Promise = require('bluebird');
const _ = require('lodash');
const helper = require('../tools/aislelabs-helper.js');
const log = require('../tools/logger.js');
const f = require('../logtools.js').f;
const config = require('config');
const moment = require('moment-timezone');
const stage = process.env.stage;
const table_templates = require('../management/templates.js')[stage];

function processDay(momentCurrentDay, callback, recordAccum, isBackfill, endBackfill) {
    let records = [];

    if (recordAccum) {
      records = recordAccum;
    }

    if (!endBackfill) {
      _.each(config.aislelabs.properties, (property) => {
          //let startTime = moment(momentCurrentDay).tz(currTZ).startOf('hour').format('x') * 1;
          var startTime = moment(momentCurrentDay).tz(property.tz).startOf('day').
                            format('x') * 1;
          var endTime = moment(momentCurrentDay).tz(property.tz).endOf('day').
                            format('x') * 1;
          
          //Convert timestamp in milliseconds to epoch miunute as required by the socialwifi API
          var epochMinuteStartTime= Math.round(startTime/60000);
          var epochMinuteEndTime= Math.round(endTime/60000);
          const filename = `DailySocialWiFi_${property.tdid}_${epochMinuteStartTime}_${epochMinuteEndTime}.json`;
          records.push(helper.getSocialWifiRequest(epochMinuteStartTime,epochMinuteEndTime,
                        property.tdid,process.env.socialwifiStreamId,
                        property.swid, table_templates.socialwifi_stream,
                        filename));
      });
    }

    if (!isBackfill || endBackfill) {
      log.log('processing backfill');
      handlers.doProcess(records, callback);
    }

    return records;
}

exports.get = (event, context, callback) => {
    log.log("Socialwifi request" );
    if (event.queryStringParameters &&
        event.queryStringParameters.start &&
        event.queryStringParameters.end) {
        log.log("Processing backfilling");
        const currentDay = moment(event.queryStringParameters.start).hour(11);
        const lastDay = moment(event.queryStringParameters.end);
        let records = [];

        while (!currentDay.isSame(lastDay, 'day')) {
            records = processDay(currentDay, callback, records, true, false);
            currentDay.add(1, 'days');
        }
        processDay(currentDay, callback, records, true, true);
    } else {
        log.log("Processing current day only" );
        const currentDay = moment().subtract(1, 'days').hour(11);
        processDay(currentDay, callback);
    }
};
