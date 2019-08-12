const helper = require('../tools/s3-helper.js');
const handlers = require('../handlers/main.js');
const config = require('config');
const moment = require('moment-timezone');
const log = require('../tools/logger.js');
const stage = process.env.stage;
const table_templates = require('../management/templates.js')[stage];

const SALES_CTI_CATEGORY_STREAM_ID = process.env.salesCtiCategoryStreamId;
const SALES_CTI_CATEGORY_NAME = 'CTI_Category';
const SALES_CTI_SPACE_STREAM_ID = process.env.salesCtiSpaceStreamId;
const SALES_CTI_SPACE_NAME = 'CTI_Space';
const SALES_CTI_PROJECT_STREAM_ID = process.env.salesCtiProjectStreamId;
const SALES_CTI_PROJECT_NAME = 'CTI_Project';
const SALES_CTI_STORE_STREAM_ID = process.env.salesCtiStoreStreamId;
const SALES_CTI_STORE_NAME = 'CTI_Store_Directory';
const SALES_CTI_TENANT_STREAM_ID = process.env.salesCtiTenantStreamId;
const SALES_CTI_TENANT_NAME = 'CTI_Tenant';
const SALES_CTI_UNIT_STREAM_ID = process.env.salesCtiUnitStreamId;
const SALES_CTI_UNIT_NAME = 'CTI_Unit';
const SALES_RCIS_CATEGORY_STREAM_ID = process.env.salesRcisCategoryStreamId;
const SALES_RCIS_CATEGORY_NAME = 'RCIS_Category_Master';

function getBucketKey(reportName, date) {
  return `sales/${reportName}_${date}.csv`
}

function backfill(event, callback, template, reportName, streamId) {
  const date = event.queryStringParameters.date;

  const formattedDate = moment(date).format('YYYY_MM_DD');
  const bucketKey = getBucketKey(reportName, formattedDate);

  processDay(bucketKey, template, streamId, callback);
}

function processDay(key, requestTemplate, streamId, callback) {
  log.log("starting sales processDay");
  const template = helper.getSalesRequest(config.s3.bucket, key, streamId, requestTemplate)
  const records = [];
  records.push(template);
  handlers.doProcess(records, callback);
}

exports.schedule_cti_category = (event, context, callback) => {
  const now = moment().subtract(1, 'days').format('YYYY_MM_DD');
  const reportDate = event.queryStringParameters ? moment(event.queryStringParameters.date).format('YYYY_MM_DD') || now : now;
  const bucketKey = getBucketKey(SALES_CTI_CATEGORY_NAME, reportDate);
  const template = table_templates.sales_cti_category_stream;

  processDay(bucketKey, template, SALES_CTI_CATEGORY_STREAM_ID, callback);
}

exports.schedule_cti_project = (event, context, callback) => {
  const now = moment().subtract(1, 'days').format('YYYY_MM_DD');
  const reportDate = event.queryStringParameters ? moment(event.queryStringParameters.date).format('YYYY_MM_DD') || now : now;
  const bucketKey = getBucketKey(SALES_CTI_PROJECT_NAME, reportDate);
  const template = table_templates.sales_cti_project_stream;

  processDay(bucketKey, template, SALES_CTI_PROJECT_STREAM_ID, callback);
}

exports.schedule_cti_space = (event, context, callback) => {
  const now = moment().subtract(1, 'days').format('YYYY_MM_DD');
  const reportDate = event.queryStringParameters ? moment(event.queryStringParameters.date).format('YYYY_MM_DD') || now : now;
  const bucketKey = getBucketKey(SALES_CTI_SPACE_NAME, reportDate);
  const template = table_templates.sales_cti_space_stream;

  processDay(bucketKey, template, SALES_CTI_SPACE_STREAM_ID, callback);
}

exports.schedule_cti_store = (event, context, callback) => {
  const now = moment().subtract(1, 'days').format('YYYY_MM_DD');
  const reportDate = event.queryStringParameters ? moment(event.queryStringParameters.date).format('YYYY_MM_DD') || now : now;
  const bucketKey = getBucketKey(SALES_CTI_STORE_NAME, reportDate);
  const template = table_templates.sales_cti_store_stream;

  processDay(bucketKey, template, SALES_CTI_STORE_STREAM_ID, callback);
}

exports.schedule_cti_tenant = (event, context, callback) => {
  const now = moment().subtract(1, 'days').format('YYYY_MM_DD');
  const reportDate = event.queryStringParameters ? moment(event.queryStringParameters.date).format('YYYY_MM_DD') || now : now;
  const bucketKey = getBucketKey(SALES_CTI_TENANT_NAME, reportDate);
  const template = table_templates.sales_cti_tenant_stream;

  processDay(bucketKey, template, SALES_CTI_TENANT_STREAM_ID, callback);
}

exports.schedule_cti_unit = (event, context, callback) => {
  const now = moment().subtract(1, 'days').format('YYYY_MM_DD');
  const reportDate = event.queryStringParameters ? moment(event.queryStringParameters.date).format('YYYY_MM_DD') || now : now;
  const bucketKey = getBucketKey(SALES_CTI_UNIT_NAME, reportDate);
  const template = table_templates.sales_cti_unit_stream;

  processDay(bucketKey, template, SALES_CTI_UNIT_STREAM_ID, callback);
}

exports.schedule_rcis_category = (event, context, callback) => {
  const now = moment().subtract(1, 'days').format('YYYY_MM_DD');
  const reportDate = event.queryStringParameters ? moment(event.queryStringParameters.date).format('YYYY_MM_DD') || now : now;
  const bucketKey = getBucketKey(SALES_RCIS_CATEGORY_NAME, reportDate);
  const template = table_templates.sales_rcis_category_stream;

  processDay(bucketKey, template, SALES_RCIS_CATEGORY_STREAM_ID, callback);
}

exports.backfill_cti_category = (event, context, callback) => {
  const template = table_templates.sales_cti_category_stream;
  backfill(event, callback, template, SALES_CTI_CATEGORY_NAME, SALES_CTI_CATEGORY_STREAM_ID);
}

exports.backfill_cti_project = (event, context, callback) => {
  const template = table_templates.sales_cti_project_stream;
  backfill(event, callback, template, SALES_CTI_PROJECT_NAME, SALES_CTI_PROJECT_STREAM_ID);
}

exports.backfill_cti_space = (event, context, callback) => {
  const template = table_templates.sales_cti_space_stream;
  backfill(event, callback, template, SALES_CTI_SPACE_NAME, SALES_CTI_SPACE_STREAM_ID);
}

exports.backfill_cti_store = (event, context, callback) => {
  const template = table_templates.sales_cti_store_stream;
  backfill(event, callback, template, SALES_CTI_STORE_NAME, SALES_CTI_STORE_STREAM_ID);
}

exports.backfill_cti_tenant = (event, context, callback) => {
  const template = table_templates.sales_cti_tenant_stream;
  backfill(event, callback, template, SALES_CTI_TENANT_NAME, SALES_CTI_TENANT_STREAM_ID);
}

exports.backfill_cti_unit = (event, context, callback) => {
  const template = table_templates.sales_cti_unit_stream;
  backfill(event, callback, template, SALES_CTI_UNIT_NAME, SALES_CTI_UNIT_STREAM_ID);
}

exports.backfill_rcis_category = (event, context, callback) => {
  const template = table_templates.sales_rcis_category_stream;
  backfill(event, callback, template, SALES_RCIS_CATEGORY_NAME, SALES_RCIS_CATEGORY_STREAM_ID);
}
