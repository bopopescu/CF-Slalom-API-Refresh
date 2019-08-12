const handlers = require('../handlers/main.js');
const dataHelper = require('../data_sources/s3.js');
const helper = require('../tools/s3-helper.js');
const config = require('config');
const moment = require('moment-timezone');
const log = require('../tools/logger.js');
const stage = process.env.stage;
const table_templates = require('../management/templates.js')[stage];

const GIFT_CARD_INFO_STREAM_ID = process.env.giftCardInfoStreamId;
const GIFT_CARD_TRANSACTION_STREAM_ID = process.env.merchantTransactionStreamId;

function processDay(fileName, requestTemplate, streamId, callback) {
  log.log("starting gift cards processDay");
  const template = helper.getGiftCardRequest(config.s3.bucket, fileName, streamId, requestTemplate)
  const records = [];
  records.push(template);
  handlers.doProcess(records, callback);
}

function getFileName(reportName, date) {
  return `${date}_${reportName}.csv`
}

exports.getGiftCardTransaction = (event, context, callback) => {
  log.log("GiftCardTransaction request" );
  if (event.queryStringParameters &&
      event.queryStringParameters.start &&
      event.queryStringParameters.end) {
    log.log("Processing backfilling");
    const currentDay = moment(event.queryStringParameters.start).hour(11);
    const lastDay = moment(event.queryStringParameters.end);
    const template = table_templates.giftcard_transaction_stream;

    while (!currentDay.isSame(lastDay, 'day')) {
      const formattedDate = moment(currentDay).format('YYYYMMDD');
      const fileName = getFileName('ProgramRawData_Transactions', formattedDate);

      dataHelper.uploadReport(fileName, 'giftcard')
        .then(() => {
          processDay(fileName, template, GIFT_CARD_TRANSACTION_STREAM_ID, callback);
        })
        .catch(err => {
          callback(null, {
            statusCode: 500,
            body: JSON.stringify({
                message: err
            })
          });
        });
        currentDay.add(1, 'day');
    }
  } else {
    const currentDay = moment().subtract(1, 'days').hour(11).format('YYYYMMDD');
    const fileName = getFileName('ProgramRawData_Transactions', currentDay);
    const template = table_templates.giftcard_transaction_stream;

    dataHelper.uploadReport(fileName, 'giftcard')
      .then(() => {
        processDay(filename, template, GIFT_CARD_TRANSACTION_STREAM_ID, callback);
      })
      .catch(err => {
        log.error('Error uploading report', err);
        callback(null, {
          statusCode: 500,
          body: JSON.stringify({
              message: err
          })
        });
      })
  }
}

exports.getGiftCardInfo = (event, context, callback) => {
  log.log("GiftCardInfo request" );
  if (event.queryStringParameters &&
      event.queryStringParameters.start &&
      event.queryStringParameters.end) {
    log.log("Processing backfilling");
    const currentDay = moment(event.queryStringParameters.start).hour(11);
    const lastDay = moment(event.queryStringParameters.end);
    const template = table_templates.giftcard_info_stream;

    while (!currentDay.isSame(lastDay, 'day')) {
      const formattedDate = moment(currentDay).format('YYYYMMDD');
      const fileName = getFileName('ProgramRawData_CardInfo', formattedDate);

      dataHelper.uploadReport(fileName, 'giftcard')
        .then(() => {
          processDay(fileName, template, GIFT_CARD_INFO_STREAM_ID, callback);
        })
        .catch(err => {
          callback(null, {
            statusCode: 500,
            body: JSON.stringify({
                message: err
            })
          });
        });
        currentDay.add(1, 'day');
    }
  } else {
    const currentDay = moment().subtract(1, 'days').hour(11).format('YYYYMMDD');
    const fileName = getFileName('ProgramRawData_CardInfo', currentDay);
    const template = table_templates.giftcard_info_stream;

    dataHelper.uploadReport(fileName, 'giftcard')
      .then(() => {
        processDay(filename, template, GIFT_CARD_INFO_STREAM_ID, callback);
      })
      .catch(err => {
        log.error('Error uploading report', err);
        callback(null, {
          statusCode: 500,
          body: JSON.stringify({
              message: err
          })
        });
      })
  }
}