'use strict';

const log = require('../tools/logger.js');

exports.getDevicesRequest = (organizationId, networkId, streamid, tableDescription, filename) => {
    const devicesRequest = {
        "extract": {
            "source": "meraki",
            "endpoint": "organizations/{organizationId}/networks/{networkid}/devices",
            "endpoint_parameters": {
                "networkid": `${networkId}`,
                "organizationId": `${organizationId}`
            }
        },
        "transform": {
            "columns": "[].serial,[].networkId,[].name,[].lat,[].lng,[].mac,[].model,[].address,[].lanIp,[].tags",
            "object_transform": "selectValues",
            "column_filters": {},
            "filetype": "JSON"
        },
        "load": {
            "streamid": streamid,
            "tableDescription": tableDescription
        },
        "storage": {
            "folder": "meraki",
            "filename": filename
        }
      };
    log.log({ name:'getDevicesRequest', template: devicesRequest});
    return devicesRequest;
}

exports.getDevicesStatusRequest = (organizationId, streamid, tableDescription, filename) => {
    const devicesStatusRequest = {
        "extract": {
            "source": "meraki",
            "endpoint": "organizations/{organizationId}/deviceStatuses",
            "endpoint_parameters": {
                "organizationId": `${organizationId}`
            }
        },
        "transform": {
            "columns": "[].serial,[].networkId,[].name,[].mac,[].status",
            "object_transform": "selectValues",
            "column_filters": {},
            "filetype": "JSON"
        },
        "load": {
            "streamid": streamid,
            "tableDescription": tableDescription
        },
        "storage": {
            "folder": "meraki",
            "filename": filename
        }
      };
    log.log({ name:'getDevicesStatusRequest', template: devicesStatusRequest});
    return devicesStatusRequest;
}