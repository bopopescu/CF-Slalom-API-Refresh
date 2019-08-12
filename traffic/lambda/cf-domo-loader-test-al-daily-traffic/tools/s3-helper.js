const log = require('../tools/logger.js');

exports.getGiftCardRequest = function(bucket, key, streamid, tableDescription) {
  const requestTemplate = {
    "extract": {
        "source": "giftcard",
        "endpoint": "",
        "skip": "1"
    },
    "transform": {
        "columns": "",
        "object_transform": "selectValues",
        "column_filters": {},
        "skip": "1",
        "filetype": "csv"
    },
    "load": {
        "folder": "temp",
        "filename": key,
        "streamid": streamid,
        "tableDescription": tableDescription
    },
    "storage": {
        "folder": "giftcard",
        "filename": key
    },
    "extract_results": ""
  };

  log.log({ name:'getGiftCardRequest', template: requestTemplate});
  return requestTemplate;
}

exports.getSalesRequest = function(bucket, key, streamid, tableDescription) {
  const requestTemplate = {
    "extract": {
        "source": "sales",
        "endpoint": "",
        "skip": "1"
    },
    "transform": {
        "columns": "",
        "object_transform": "selectValues",
        "column_filters": {},
        "skip": "1",
        "filetype": "csv"
    },
    "load": {
        "streamid": streamid,
        "tableDescription": tableDescription
    },
    "storage": {
        "folder": "sales",
        "filename": key
    },
    "extract_results": ""
  };

  log.log({ name:'getSalesRequest', template: requestTemplate});
  return requestTemplate;
}