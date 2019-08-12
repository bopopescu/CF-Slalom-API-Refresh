'use strict';

const aislelabs = require('../data_sources/aislelabs.js');
const Promise = require('bluebird');
const moment = require('moment-timezone');
const helper = require('../tools/helper.js');
const log = require('../tools/logger.js');
const endpoint = {
    "filtered": "metrics/report.json",
    "raw": "metrics/unfilteredReport.json",
    "space": "metrics/spaces.json",
    "floor": "metrics/floors"
}


exports.getDashboardRawPropertyRequest = function(startTime, endTime, tdid, streamid, tableDescription, filename) {
    const requestTemplate = {
        "extract": {
            "endpoint": endpoint["raw"],
            "endpoint_parameters": {
                "tdid": `${tdid}`,
                "startTime": startTime,
                "endTime": endTime
            }
        },
        "transform": {
            "columns": "request.startTime,response[].tdid,response[].visits,request.startTime",
            "object_transform": "selectValues",
            "column_filters": {
                "0": {
                    "type": "date_format",
                    "args": "YYYY-MM-DD HH:mm:ss"
                },
                "3": {
                    "type": "dateLocalTime_format",
                    "args": "YYYY-MM-DD HH:mm:ss",
                    "tdid": "1"
                }
            },
            "filetype": "JSON"
        },
        "load": {
            "folder": "temp",
            "filename": filename,
            "streamid": streamid,
            "tableDescription": tableDescription
        },
        "storage": {
            "folder": "aislelabs",
            "filename": filename
        }
    };
    log.log({ name:'getDashboardRawPropertyRequest', template: requestTemplate});
    return requestTemplate;
}

exports.getDashboardFilteredPropertyRequest = function(startTime, endTime, tdid, streamid, tableDescription, filename) {
    const requestTemplate = {
        "extract": {
            "endpoint": endpoint["filtered"],
            "endpoint_parameters": {
                "tdid": `${tdid}`,
                "startTime": startTime,
                "endTime": endTime
            }
        },
        "transform": {
            "columns": "request.startTime,response.flowReportObjects[].tdid,response.flowReportObjects[].storeOverview.visitors,response.flowReportObjects[].storeOverview.visitorsAvgDwell,response.flowReportObjects[].storeOverview.visitorsNew,response.flowReportObjects[].storeOverview.visitorsRepeat,response.flowReportObjects[].windowConversion.visitorsUniq",
            "object_transform": "selectValues",
            "column_filters": {
                "0": {
                    "type": "date_format",
                    "args": "YYYY-MM-DD HH:mm:ss"
                }
            },
            "filetype": "JSON"
        },
        "load": {
            "folder": "temp",
            "filename": filename,
            "streamid": streamid,
            "tableDescription": tableDescription
        },
        "storage": {
            "folder": "aislelabs",
            "filename": filename
        }
    };
    log.log({ name:'getDashboardFilteredPropertyRequest', template: requestTemplate});
    return requestTemplate;
}

exports.getDashboardSpaceRequest = function(startTime, endTime, tdids, streamid, tableDescription, filename) {
    const requestTemplate = {
        "extract": {
            "endpoint": endpoint["filtered"],
            "endpoint_parameters": {
                "tdid": `${tdids}`,
                "startTime": startTime,
                "endTime": endTime
            }
        },
        "transform": {
            "columns": "request.startTime,response.flowReportObjects[].tdid,response.flowReportObjects[].spaceOverviews[].spaceName,response.flowReportObjects[].spaceOverviews[].spaceTid,response.flowReportObjects[].spaceOverviews[].spaceVisitors,response.flowReportObjects[].spaceOverviews[].spaceVisitorsPercent,response.flowReportObjects[].spaceOverviews[].spaceAvgDwellMins",
            "object_transform": "selectValues",
            "array_transform": "atomizeIfOne",
            "column_filters": {
                "0": {
                    "type": "date_format",
                    "args": "YYYY-MM-DD HH:mm:ss"
                }
            },
            "filetype": "JSON"
        },
        "load": {
            "folder": "temp",
            "filename": filename,
            "streamid": streamid,
            "tableDescription": tableDescription
        },
        "storage": {
            "folder": "aislelabs",
            "filename": filename
        }
    };
    log.log({ name:'getDashboardSpaceRequest', template: requestTemplate});
    return requestTemplate;
}

exports.getDashboardPropertyDwellRequest = function(startTime, endTime, tdid, streamid, tableDescription, filename) {
    const requestTemplate = {
        "extract": {
            "endpoint": endpoint["filtered"],
            "endpoint_parameters": {
                "tdid": `${tdid}`,
                "startTime": startTime,
                "endTime": endTime
            }
        },
        "transform": {
            "columns": "request.startTime,request.tdid,response.flowReportObjects[].storeOverview.durationDistribution[].rangeMinMinutes,response.flowReportObjects[].storeOverview.durationDistribution[].rangeMaxMinutes, response.flowReportObjects[].storeOverview.durationDistribution[].visitCount",
            "object_transform": "selectValues",
            "column_filters": {
                "0": {
                    "type": "date_format",
                    "args": "YYYY-MM-DD HH:mm:ss"
                }
            },
            "filetype": "JSON"
        },
        "load": {
            "folder": "temp",
            "filename": filename,
            "streamid": streamid,
            "tableDescription": tableDescription
        },
        "storage": {
            "folder": "aislelabs",
            "filename": filename
        }
    };
    log.log({ name:'getDashboardPropertyDwellRequest', template: requestTemplate});
    return requestTemplate;
}

exports.getDashboardSpaceDwellRequest = function(startTime, endTime, tdid, streamid, tableDescription, filename) {
    const requestTemplate = {
        "extract": {
            "endpoint": endpoint["space"],
            "endpoint_parameters": {
                "tdid": `${tdid}`,
                "startTime": startTime,
                "endTime": endTime
            }
        },
        "transform": {
            "columns": "request.startTime,request.tdid,response.tid,response.spaceName,response.durationDistribution[].rangeMinMinutes,response.durationDistribution[].rangeMaxMinutes, response.durationDistribution[].visitCount",
            "object_transform": "selectValues",
            "column_filters": {
                "0": {
                    "type": "date_format",
                    "args": "YYYY-MM-DD HH:mm:ss"
                }
            },
            "filetype": "JSON",
            "nested": "1",
            "nestedKey": "response.flowSpaceObjects",
            "newNestedkey": "response",
            "keepKey": "request"
        },
        "load": {
            "folder": "temp",
            "filename": filename,
            "streamid": streamid,
            "tableDescription": tableDescription
        },
        "storage": {
            "folder": "aislelabs",
            "filename": filename
        }
    };
    log.log({ name:'getDashboardSpaceDwellRequest', template: requestTemplate});
    return requestTemplate;
}

exports.getDashboardFloorRequest = function(startTime, endTime, tdid, streamid, tableDescription, filename) {
    const requestTemplate = {
        "extract": {
            "endpoint": endpoint["floor"],
            "endpoint_parameters": {
                "tdid": `${tdid}`,
                "startTime": startTime,
                "endTime": endTime
            }
        },
        "transform": {
            "columns": "request.startTime,request.tdid,response.floors[].floorName,response.floors[].visitedPercent,response.floors[].territoryTimeAvg,response.floors[].repeatPercent,response.floors[].engagedPercent,response.floors[].otherSpaces",
            "object_transform": "selectValues",
            "column_filters": {
                "0": {
                    "type": "date_format",
                    "args": "YYYY-MM-DD HH:mm:"
                }
            },
            "filetype": "JSON"
        },
        "load": {
            "folder": "temp",
            "filename": filename,
            "streamid": streamid,
            "tableDescription": tableDescription
        },
        "storage": {
            "folder": "aislelabs",
            "filename": filename
        }
    };
    log.log({ name:'getDashboardFloorRequest', template: requestTemplate});
    return requestTemplate;
}

exports.getFrequencyRequest = function(startTime, ndays, tdids, streamid, tableDescription, filename) {

const requestTemplate = {
        "extract": {
            "endpoint": "metrics/frequency",
			"include_params": 1,
            "endpoint_parameters": {
                "tdid": `${tdids}`,
                "date": startTime,
                "ndays": ndays
            }
        },
        "transform": {
            "columns": "response.start_date,response.end_date,params.tdid,response.recency_all.duration_ms,response.recency_all.display,response.avg_visits,response.recency.duration_ms,response.recency.display",
            "object_transform": "",
            "array_transform": "",
            "column_filters": {
            },
            "filetype": "JSON"
        },
        "load": {
            "folder": "temp",
            "filename": filename,
            "streamid": streamid,
            "tableDescription": tableDescription
        },
        "storage": {
            "folder": "aislelabs",
            "filename": filename
        }
    };
    log.log({ name:'getFrequencyRequest', template: requestTemplate});
    return requestTemplate;

}

exports.getCrossVisitorRequest = function(startTime, endTime, tdids, streamid, tableDescription, filename) {
const requestTemplate = {
        "extract": {
            "endpoint": "metrics/crossvisitor.json",
            "endpoint_parameters": {
                "tdid": tdids,
                "startTime": startTime,
                "endTime": endTime 
            }
        },
        "transform": {
            "columns": "request.startTime, request.endTime,response.flowCrossVisitorObjects",
            "object_transform": "selectValues",
            "array_transform": "explodeObject",
            "after_transform": "groupColumns",
            "column_filters": {
                "0": {
                    "type": "date_format",
                    "args": "YYYY-MM-DD HH:mm:ss"
                },
                "1": {
                    "type": "date_format",
                    "args": "YYYY-MM-DD HH:mm:ss"
                }
            },
            "filetype": "JSON"
        },
        "load": {
            "folder": "temp",
            "filename": filename,
            "streamid": streamid,
            "tableDescription": tableDescription
        },
        "storage": {
            "folder": "aislelabs",
            "filename": filename
        }
    };
    log.log({ name:'getCrossVisitorRequest', template: requestTemplate});
    return requestTemplate;

}

exports.getVisitorFlowRequest = function(startTime, endTime, tdids, streamid, fppl, tableDescription, filename) {
const requestTemplate = {
		"extract":{
			"endpoint": "metrics/trends.json",
            "endpoint_parameters": {
                "tdid": tdids,
                "startTime": startTime,
                "endTime": endTime,
                "granularity": "HOURLY",
                "fppl": fppl
            }
		},
		"transform": {
            "columns": "@response.everyone,request.tdid,request.fppl,response.everyone,response.visitors,response.uniqVisitors",
            "object_transform": "selectValues",
            "column_filters": { 
                "0": { 
                    "type": "date_format", 
                    "args":"YYYY-MM-DD HH:mm:ss" 
                }
            },
            "filetype": "JSON"
        },
		"load": {
            "folder": "temp",
            "filename": filename,
            "streamid" : streamid,
            "tableDescription": tableDescription
        },
        "storage": {
            "folder": "aislelabs",
            "filename": filename
        }
	};
    log.log({ name:'getVisitorFlowRequest', template: requestTemplate});
    return requestTemplate;
}

exports.getSocialWifiRequest = function(epochMinuteStartTime,epochMinuteEndTime, tdids, streamid, swid, tableDescription, filename) {
    const requestTemplate = {
            "extract":{
                "endpoint": "socialwifi/metrics.json",
                "endpoint_parameters": {
                    "tdid": tdids,
                    "swid": swid,
                    "smid": epochMinuteStartTime,
                    "emid": epochMinuteEndTime
                }
            },
            "transform": {
                "columns": "response.start.date,request.tdid,response.uniqueConnectedVisitors,response.genderTypes.total,response.genderTypes.countsMap.MALE,response.genderTypes.countsMap.FEMALE,response.loginTypes.total,response.loginTypes.countsMap.FACEBOOK,response.loginTypes.countsMap.EMAIL,response.loginTypes.countsMap.TWITTER",
                "object_transform": "selectValues",
                "column_filters": {
                    "0": {
                        "type": "date_format",
                        "args": "YYYY-MM-DD"
                    }
                },
                "filetype": "JSON"
            },
            "load": {
                "folder": "temp",
                "filename": filename,
                "streamid" : streamid,
                "tableDescription": tableDescription
            },
            "storage": {
                "folder": "aislelabs",
                "filename": filename
            }
        };
        log.log({ name:'getSocialWifiRequest', template: requestTemplate});
        return requestTemplate;
    }
