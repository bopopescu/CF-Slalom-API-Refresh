'use strict';

const handlers = require('../handlers/main.js');
const Promise = require('bluebird');
const _ = require('lodash');
const helper = require('../tools/aislelabs-helper.js');
const log = require('../tools/logger.js');
const config = require('config');
const stage = process.env.stage;
const table_templates = require('../management/templates.js')[stage];

const moment = require('moment-timezone');


function isDstChangeDate(dtdate, tz) {
  var curDst = moment(dtdate).tz(tz).isDST()
  var prevDst = moment(dtdate).tz(tz).clone().subtract(1, "day").isDST();
  var nextDst = moment(dtdate).tz(tz).clone().add(1, "day").isDST();
  return (curDst !== nextDst) || (curDst !== prevDst);
}

function processDailyTraffic(currentDay, callback, recordAccum, isBackfill, endBackfill) {
  let records = [];

  if (recordAccum) {
    records = recordAccum;
  }

  if (!endBackfill) {
    // Hourly traffic  
    _.each(config.aislelabs.properties, (property) => {

      let initialTime = moment(currentDay).tz(property.tz).startOf('day');

      for (let i = 0; i < 24; i++) {

        let startTime = moment(initialTime).add(i, 'hours').startOf('hour').format('x') * 1;
        let endTime = moment(initialTime).add(i, 'hours').endOf('hour').format('x') * 1;
        // Filtered TDIDs requests       
        const filenameHourlySpaceRequest = `DashboardHourlySpace_${property.tdid}_${startTime}_${endTime}.json`;
        records.push(helper.getDashboardSpaceRequest(startTime, endTime,
          property.tdid, process.env.hourlyFilteredSpaceStreamId,
          table_templates.dashboard_space_stream_filtered_hourly,
          filenameHourlySpaceRequest));
        const filenameHourlyFilteredProperty = `DashboardHourlyFilteredProperty_${property.tdid}_${startTime}_${endTime}.json`;
        records.push(helper.getDashboardFilteredPropertyRequest(startTime, endTime,
          property.tdid, process.env.hourlyFilteredPropertyStreamId,
          table_templates.dashboard_property_stream_filtered_hourly,
          filenameHourlyFilteredProperty));
        // Raw TDIDs requests
        const filenameHourlyRawProperty = `DashboardHourlyRawProperty_${property.tdid}_${startTime}_${endTime}.json`;
        records.push(helper.getDashboardRawPropertyRequest(startTime, endTime,
          property.tdid, process.env.hourlyRawPropertyStreamId,
          table_templates.dashboard_property_stream_raw_hourly,
          filenameHourlyRawProperty));
      }

      if (isDstChangeDate(currentDay, property.tz)) {

        let startTime = moment(initialTime).add(24, 'hours').startOf('hour').format('x') * 1;
        let endTime = moment(initialTime).add(24, 'hours').endOf('hour').format('x') * 1;

        log.log({
          message: 'DST day change',
          property: property.tdid,
          propertytz: property.tz,
          startTime: startTime,
          endTime: endTime
        });

        const filenameHourlySpaceRequest = `DashboardHourlySpace_${property.tdid}_${startTime}_${endTime}.json`;
        records.push(helper.getDashboardSpaceRequest(startTime, endTime,
          property.tdid, process.env.hourlyFilteredSpaceStreamId,
          table_templates.dashboard_space_stream_filtered_hourly,
          filenameHourlySpaceRequest));
        const filenameHourlyFilteredProperty = `DashboardHourlyFilteredProperty_${property.tdid}_${startTime}_${endTime}.json`;
        records.push(helper.getDashboardFilteredPropertyRequest(startTime, endTime,
          property.tdid, process.env.hourlyFilteredPropertyStreamId,
          table_templates.dashboard_property_stream_filtered_hourly,
          filenameHourlyFilteredProperty));
        // Raw TDIDs requests
        const filenameHourlyRawProperty = `DashboardHourlyRawProperty_${property.tdid}_${startTime}_${endTime}.json`;
        records.push(helper.getDashboardRawPropertyRequest(startTime, endTime,
          property.tdid, process.env.hourlyRawPropertyStreamId,
          table_templates.dashboard_property_stream_raw_hourly,
          filenameHourlyRawProperty));
      }
    });

    // Daily traffic  
    _.each(config.aislelabs.properties, (property) => {

      let startTime = moment(currentDay).tz(property.tz).startOf('day').format('x') * 1;
      let endTime = moment(currentDay).tz(property.tz).endOf('day').format('x') * 1;

      // Filtered TDIDs requests
      const filenameDailySpace = `DashboardDailySpace_${property.tdid}_${startTime}_${endTime}.json`;
      records.push(helper.getDashboardSpaceRequest(startTime, endTime,
        property.tdid, process.env.dailyFilteredSpaceStreamId,
        table_templates.dashboard_space_stream_filtered_daily,
        filenameDailySpace));
      const filenameDailyFilteredProperty = `DashboardDailyFilteredProperty_${property.tdid}_${startTime}_${endTime}.json`;
      records.push(helper.getDashboardFilteredPropertyRequest(startTime, endTime,
        property.tdid, process.env.dailyFilteredPropertyStreamId,
        table_templates.dashboard_property_stream_filtered_daily,
        filenameDailyFilteredProperty));
      // Raw TDIDs requests
      const filenameDailyRawProperty = `DashboardDailyRawProperty_${property.tdid}_${startTime}_${endTime}.json`;
      records.push(helper.getDashboardRawPropertyRequest(startTime, endTime,
        property.tdid, process.env.dailyRawPropertyStreamId,
        table_templates.dashboard_property_stream_raw_daily,
        filenameDailyRawProperty));
      // Floor requests
      const filenameDailyFloor = `DashboardDailyFloor_${property.tdid}_${startTime}_${endTime}.json`;
      records.push(helper.getDashboardFloorRequest(startTime, endTime,
        property.tdid, process.env.dailyFloorStreamId,
        table_templates.dashboard_floor_stream_daily,
        filenameDailyFloor));
    });
  }

  if (!isBackfill || endBackfill) {
    log.log('processing backfill');
    handlers.doProcess(records, callback);
  }

  return records;
}

function processDwellTime(currentDay, callback, recordAccum, isBackfill, endBackfill) {
  let records = [];

  if (recordAccum) {
    records = recordAccum;
  }

  if (!endBackfill) {
    _.each(config.aislelabs.properties, (property) => {
      let startTime = moment(currentDay).tz(property.tz).startOf('day').
        format('x') * 1;
      let endTime = moment(currentDay).tz(property.tz).endOf('day').
        format('x') * 1;
      const filenameDailyPropertyDwell = `DailyPropertyDwell_${property.tdid}_${startTime}_${endTime}.json`;
      const filenameDailySpaceDwell = `DailySpaceDwell_${property.tdid}_${startTime}_${endTime}.json`;
      records.push(helper.getDashboardPropertyDwellRequest(startTime, endTime,
        property.tdid, process.env.dailyPropertyDwellStreamId,
        table_templates.dashboard_property_stream_dwell_daily,
        filenameDailyPropertyDwell));
      records.push(helper.getDashboardSpaceDwellRequest(startTime, endTime,
        property.tdid, process.env.dailySpaceDwellStreamId,
        table_templates.dashboard_space_stream_dwell_daily,
        filenameDailySpaceDwell));
    });
  }

  if (!isBackfill || endBackfill) {
    log.log('processing backfill');
    handlers.doProcess(records, callback);
  }

  return records;
}

function processMonth(year, month, callback) {
  let records = [];

  _.each(config.aislelabs.properties, (property) => {
    let startTime = moment().tz(property.tz).month(month).year(year).startOf('month').format('x') * 1;
    let endTime = moment().tz(property.tz).month(month).year(year).endOf('month').format('x') * 1;

    // Filtered TDIDs requests
    const filenameDashboardMonthlySpace = `DashboardMonthlySpace_${property.tdid}_${startTime}_${endTime}.json`;
    records.push(helper.getDashboardSpaceRequest(startTime, endTime,
      property.tdid, process.env.monthlyFilteredSpaceStreamId,
      table_templates.dashboard_space_stream_filtered_monthly,
      filenameDashboardMonthlySpace));
    const filenameDashboardMonthlyFilteredProperty = `DashboardMonthlyFilteredProperty_${property.tdid}_${startTime}_${endTime}.json`;
    records.push(helper.getDashboardFilteredPropertyRequest(startTime, endTime,
      property.tdid, process.env.monthlyFilteredPropertyStreamId,
      table_templates.dashboard_property_stream_filtered_monthly,
      filenameDashboardMonthlyFilteredProperty));
    // Raw TDIDs requests
    const filenameDashboardMonthlyRawProperty = `DashboardMonthlyRawProperty_${property.tdid}_${startTime}_${endTime}.json`;
    records.push(helper.getDashboardRawPropertyRequest(startTime, endTime,
      property.tdid, process.env.monthlyRawPropertyStreamId,
      table_templates.dashboard_property_stream_raw_monthly,
      filenameDashboardMonthlyRawProperty));
    // Property Filtered Dwell time
    const filenameMonthlyPropertyDwell = `MonthlyPropertyDwell_${property.tdid}_${startTime}_${endTime}.json`;
    records.push(helper.getDashboardPropertyDwellRequest(startTime, endTime,
      property.tdid, process.env.monthlyPropertyDwellStreamId,
      table_templates.dashboard_property_stream_dwell_monthly,
      filenameMonthlyPropertyDwell));
    // Space Dwell time
    const filenameMonthlySpaceDwell = `MonthlySpaceDwell_${property.tdid}_${startTime}_${endTime}.json`;
    records.push(helper.getDashboardSpaceDwellRequest(startTime, endTime,
      property.tdid, process.env.monthlySpaceDwellStreamId,
      table_templates.dashboard_space_stream_dwell_monthly,
      filenameMonthlySpaceDwell));
  });

  handlers.doProcess(records, callback);
}

exports.schedule = (event, context, callback) => {
  // const currentDay = moment().add(-14, 'days').startOf('day');

};

exports.getDailyTraffic = (event, context, callback) => {
  log.log("Daily traffic request");
  if (event.queryStringParameters &&
    event.queryStringParameters.start &&
    event.queryStringParameters.end) {
    log.log("Processing backfilling");
    const currentDay = moment(event.queryStringParameters.start).hour(11);
    const lastDay = moment(event.queryStringParameters.end);
    let records = [];

    while (!currentDay.isSame(lastDay, 'day')) {
      records = processDailyTraffic(currentDay, callback, records, true, false);
      currentDay.add(1, 'days');
    }
    processDailyTraffic(currentDay, callback, records, true, true);
  } else {
    log.log("Processing current day only");
    const currentDay = moment().subtract(1, 'days').hour(11);
    processDailyTraffic(currentDay, callback);
  }
};

exports.getDailyTraffic_refresh_8 = (event, context, callback) => {
  log.log("Daily traffic request");
  if (event.queryStringParameters &&
    event.queryStringParameters.start &&
    event.queryStringParameters.end) {
    log.log("Processing backfilling");
    const currentDay = moment(event.queryStringParameters.start).hour(11);
    const lastDay = moment(event.queryStringParameters.end);
    let records = [];

    while (!currentDay.isSame(lastDay, 'day')) {
      records = processDailyTraffic(currentDay, callback, records, true, false);
      currentDay.add(1, 'days');
    }
    processDailyTraffic(currentDay, callback, records, true, true);
  } else {
    log.log("Processing current day-8 only");
    const currentDay = moment().subtract(8, 'days').hour(11);
    processDailyTraffic(currentDay, callback);
  }
};

exports.getDailyTraffic_refresh_15 = (event, context, callback) => {
  log.log("Daily traffic request");
  if (event.queryStringParameters &&
    event.queryStringParameters.start &&
    event.queryStringParameters.end) {
    log.log("Processing backfilling");
    const currentDay = moment(event.queryStringParameters.start).hour(11);
    const lastDay = moment(event.queryStringParameters.end);
    let records = [];

    while (!currentDay.isSame(lastDay, 'day')) {
      records = processDailyTraffic(currentDay, callback, records, true, false);
      currentDay.add(1, 'days');
    }
    processDailyTraffic(currentDay, callback, records, true, true);
  } else {
    log.log("Processing current day-15 only");
    const currentDay = moment().subtract(15, 'days').hour(11);
    processDailyTraffic(currentDay, callback);
  }
};

exports.getDailyTraffic_refresh_22 = (event, context, callback) => {
  log.log("Daily traffic request");
  if (event.queryStringParameters &&
    event.queryStringParameters.start &&
    event.queryStringParameters.end) {
    log.log("Processing backfilling");
    const currentDay = moment(event.queryStringParameters.start).hour(11);
    const lastDay = moment(event.queryStringParameters.end);
    let records = [];

    while (!currentDay.isSame(lastDay, 'day')) {
      records = processDailyTraffic(currentDay, callback, records, true, false);
      currentDay.add(1, 'days');
    }
    processDailyTraffic(currentDay, callback, records, true, true);
  } else {
    log.log("Processing current day-22 only");
    const currentDay = moment().subtract(22, 'days').hour(11);
    processDailyTraffic(currentDay, callback);
  }
};

exports.getDailyTraffic_refresh_29 = (event, context, callback) => {
  log.log("Daily traffic request");
  if (event.queryStringParameters &&
    event.queryStringParameters.start &&
    event.queryStringParameters.end) {
    log.log("Processing backfilling");
    const currentDay = moment(event.queryStringParameters.start).hour(11);
    const lastDay = moment(event.queryStringParameters.end);
    let records = [];

    while (!currentDay.isSame(lastDay, 'day')) {
      records = processDailyTraffic(currentDay, callback, records, true, false);
      currentDay.add(1, 'days');
    }
    processDailyTraffic(currentDay, callback, records, true, true);
  } else {
    log.log("Processing current day-29 only");
    const currentDay = moment().subtract(29, 'days').hour(11);
    processDailyTraffic(currentDay, callback);
  }
};



exports.getMonthlyTraffic = (event, context, callback) => {
  log.log("Monthly traffic request");
  if (event.queryStringParameters && event.queryStringParameters.year && event.queryStringParameters.month) {
    log.log("Processing backfilling");
    processMonth(event.queryStringParameters.year, event.queryStringParameters.month, callback);
  } else {
    log.log("Processing current month only");
    // I am not subtracting one month because of what processMonth expects
    const previousMonthDate = moment().subtract(1, 'months');
    processMonth(moment(previousMonthDate).year(), moment(previousMonthDate).month(), callback);
  }
};

exports.getDailyDwell = (event, context, callback) => {
  log.log("Dwell request");
  if (event.queryStringParameters &&
    event.queryStringParameters.start &&
    event.queryStringParameters.end) {
    log.log("Processing backfilling");
    const currentDay = moment(event.queryStringParameters.start).hour(11);
    const lastDay = moment(event.queryStringParameters.end);
    let records = [];

    while (!currentDay.isSame(lastDay, 'day')) {
      records = processDwellTime(currentDay, callback, records, true, false);
      currentDay.add(1, 'days');
    }
    processDwellTime(currentDay, callback, records, true, true);
  } else {
    log.log("Processing current day only");
    const currentDay = moment().subtract(1, 'days').hour(11);
    processDwellTime(currentDay, callback);
  }
};

exports.getDailyDwell_refresh_8 = (event, context, callback) => {
  log.log("Dwell request");
  if (event.queryStringParameters &&
    event.queryStringParameters.start &&
    event.queryStringParameters.end) {
    log.log("Processing backfilling");
    const currentDay = moment(event.queryStringParameters.start).hour(11);
    const lastDay = moment(event.queryStringParameters.end);
    let records = [];

    while (!currentDay.isSame(lastDay, 'day')) {
      records = processDwellTime(currentDay, callback, records, true, false);
      currentDay.add(1, 'days');
    }
    processDwellTime(currentDay, callback, records, true, true);
  } else {
    log.log("Processing current day-8 only");
    const currentDay = moment().subtract(8, 'days').hour(11);
    processDwellTime(currentDay, callback);
  }
};


exports.getDailyDwell_refresh_15 = (event, context, callback) => {
  log.log("Dwell request");
  if (event.queryStringParameters &&
    event.queryStringParameters.start &&
    event.queryStringParameters.end) {
    log.log("Processing backfilling");
    const currentDay = moment(event.queryStringParameters.start).hour(11);
    const lastDay = moment(event.queryStringParameters.end);
    let records = [];

    while (!currentDay.isSame(lastDay, 'day')) {
      records = processDwellTime(currentDay, callback, records, true, false);
      currentDay.add(1, 'days');
    }
    processDwellTime(currentDay, callback, records, true, true);
  } else {
    log.log("Processing current day-15 only");
    const currentDay = moment().subtract(15, 'days').hour(11);
    processDwellTime(currentDay, callback);
  }
};


exports.getDailyDwell_refresh_22 = (event, context, callback) => {
  log.log("Dwell request");
  if (event.queryStringParameters &&
    event.queryStringParameters.start &&
    event.queryStringParameters.end) {
    log.log("Processing backfilling");
    const currentDay = moment(event.queryStringParameters.start).hour(11);
    const lastDay = moment(event.queryStringParameters.end);
    let records = [];

    while (!currentDay.isSame(lastDay, 'day')) {
      records = processDwellTime(currentDay, callback, records, true, false);
      currentDay.add(1, 'days');
    }
    processDwellTime(currentDay, callback, records, true, true);
  } else {
    log.log("Processing current day-22 only");
    const currentDay = moment().subtract(22, 'days').hour(11);
    processDwellTime(currentDay, callback);
  }
};

exports.getDailyDwell_refresh_29 = (event, context, callback) => {
  log.log("Dwell request");
  if (event.queryStringParameters &&
    event.queryStringParameters.start &&
    event.queryStringParameters.end) {
    log.log("Processing backfilling");
    const currentDay = moment(event.queryStringParameters.start).hour(11);
    const lastDay = moment(event.queryStringParameters.end);
    let records = [];

    while (!currentDay.isSame(lastDay, 'day')) {
      records = processDwellTime(currentDay, callback, records, true, false);
      currentDay.add(1, 'days');
    }
    processDwellTime(currentDay, callback, records, true, true);
  } else {
    log.log("Processing current day-29 only");
    const currentDay = moment().subtract(29, 'days').hour(11);
    processDwellTime(currentDay, callback);
  }
};