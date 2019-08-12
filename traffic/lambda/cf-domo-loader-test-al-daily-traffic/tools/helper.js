'use strict';
const moment = require('moment-timezone');
const crypto = require('crypto');
const log = require('../tools/logger.js');
const f = require('../logtools.js').f;
const _ = require('lodash');
const Promise = require('bluebird');
const db = require('./db.js');
const config = require('config');

const knownTypes = ['STRING', 'DECIMAL', 'LONG', 'DOUBLE', 'DATE', 'DATETIME'];

exports.createTemplate = (datasetName, parametersStr, updateMethod) => {
    const method = updateMethod || "APPEND";
    const parameters = parametersStr.split(',');
    const template = {
        dataSet: {
            name: datasetName,
            rows: 0,
            schema: {
                columns: []
            }
        },
        updateMethod: method
    };

    for (let i = 0; i < parameters.length; i++) {
        const pair = parameters[i].split(':');
        const name = pair[0].trim();
        const type = pair[1].trim();
        if (name != "" && type != "" && knownTypes.lastIndexOf(type) > -1) {
            template.dataSet.schema.columns.push({
                type,
                name
            });
        }
    }

    return template;
}

function isArrayOfObjects(item) {
    //Assuming that all the items are of the same type of course, if not we have biggest problems that should be caught earlier.
    return Array.isArray(item) && _.isPlainObject(item[0]);
}

function flattenArrayOfObjects(objArr) {
    let result = [];
    let flattenObj = {};

    for (let i = 0; i < objArr.length; i++) {
        const keys = _.keys(objArr[i]);
        for (let k = 0; k < keys.length; k++) {
            if (flattenObj[keys[k]]) {
                flattenObj[keys[k]] = [];
            }
            flattenObj[keys[k]].push(objArr[i][keys[k]]);
        }
    }

    let resultKeys = _keys(flattenObj);
    let resultValues = _values(flattenObj);
    result.push(resultKeys);
    result = result.concat(resultValues);
    return result;
}

function getValueFromPath(obj, path, shouldUseKeys) {
    path = path.trim();
    let useKeys = _.startsWith(path, '@');
    if (useKeys) {
        path = path.substring(1);
    }

    if (shouldUseKeys && !useKeys) {
        useKeys = true;
    }

    const parts = path.split(".");
    let current = obj;

    for (let i = 0; i < parts.length; i++) {

        if (Array.isArray(current)) {
            return _.flattenDeep([].concat(_.map(current, (v, k) => {
                return getValueFromPath(v, path, useKeys);
            })));
        }

        if (parts[i].lastIndexOf('[]') < 0) {
            current = current[parts[i]];
        } else {
            const current_part = parts[i].replace('[]', '');
            if (current_part != "") {
                current = current[current_part];
            }
            return getValueFromPath(current, parts.slice(i + 1).join('.'), useKeys);
        }
    }

    if (useKeys) {
        current = _.keys(current);
    }
    log.log({
        flattenedObj: current
    });
    return current;
}

exports.reduceNesting = (obj, nestedKey, newNestedkey, keepKey) => {
    let result = [];
    const nestedObj = _.get(obj, nestedKey);
    _.forEach(nestedObj, function (value) {
        let newobj = {}
        newobj[newNestedkey] = value;
        if (keepKey) {
            newobj[keepKey] = _.get(obj, keepKey);;
        }
        result.push(newobj);
    });
    return result;
}

exports.transform = (obj, columnsDescriptor, objectFilter, arrayFilter, afterFilter) => {
    log.log({
        "transform funtion called, obj": obj, "columnsDescriptor": columnsDescriptor,
        "objectFilter": objectFilter, "arrayFilter": objectFilter, "afterFilter": objectFilter
    });
    let localObjFilter = objectFilter;
    let localArrFilter = arrayFilter;
    let localAfterFilter = afterFilter;
    if (_.isString(objectFilter)) {
        localObjFilter = filters[objectFilter];
    }

    if (_.isString(arrayFilter)) {
        localArrFilter = filters[arrayFilter];
    }

    if (_.isString(afterFilter)) {
        localAfterFilter = filters[afterFilter];
    }


    const fields = columnsDescriptor.split(',');
    const objFilter = (obj) => {
        if (objectFilter && _.isPlainObject(obj)) {
            return localObjFilter(obj);
        } else {
            return obj;
        }
    };
    const arrFilter = (arr) => {
        if (localArrFilter) {
            return localArrFilter(arr);
        } else {
            return arr;
        }
    };

    const aftFilter = (arr) => {
        if (localAfterFilter) {
            return localAfterFilter(arr);
        } else {
            return arr;
        }
    };

    return _.chain(fields).map((v, k) => {
        return getValueFromPath(obj, v);
    })
        .map(objFilter)
        .map(arrFilter)
        .thru(aftFilter)
        .value();
}

function groupColumns(arr) {

    const result = [];
    let columns = 0;

    // First let check how many columns we have
    for (let i = 0; i < arr.length; i++) {
        if (!Array.isArray(arr[i])) {
            columns++;
            result.push(0);
        } else {
            columns += arr[i][0].length;
            for (let j = 0; j < arr[i][0].length; j++) {
                result.push([]);
            }
        }
    }


    // Now. let's split the columns.
    for (let i = 0; i < arr.length; i++) {
        let item = arr[i];
        if (!Array.isArray(item)) {
            result[i] = item;
        } else {
            for (let r = 0; r < item.length; r++) {
                let row = item[r];
                for (let col = 0; col < row.length; col++) {
                    result[col + i].push(row[col]);
                }
            }
        }
    }

    return result;
}

function objectToRows(arr) {
    if (!Array.isArray(arr))
        return arr;

    const transformObject = (obj) => {

        let result = [];
        let objColumnIndex = -1;
        const keys = _.keys(obj);

        for (let i = 0; i < keys.length; i++) {
            let value = obj[keys[i]];
            result.push(value);

            if (_.isPlainObject(value)) {
                objColumnIndex = i;
            }
        }

        //Second pass to deal with the object column.

        if (objColumnIndex > 0) {
            let templateRow = result;
            let theObjectColumn = result[objColumnIndex];
            let objKeys = _.keys(theObjectColumn);
            result = [];

            for (let i = 0; i < objKeys.length; i++) {
                let newRow = templateRow;
                let subArr = [objKeys[i], theObjectColumn[objKeys[i]]];
                newRow[objColumnIndex] = [];

                newRow = _.slice(newRow, 0, objColumnIndex).concat(subArr).concat(_.slice(newRow, objColumnIndex + 1));
                result.push(newRow);
            }
        }

        return result;
    };

    return _.chain(arr).flatMap((v, k) => {
        let arr = transformObject(v);
        return arr;
    })
        .value();
}

const filters = {
    selectKeys: (obj) => {
        return _.keys(obj);
    },
    selectValues: (obj) => {
        return _.values(obj);
    },
    groupColumns: groupColumns,
    explodeObject: objectToRows,
    atomizeIfOne: (arr) => {
        if (Array.isArray(arr) && arr.length == 1) {
            return arr[0];
        } else {
            return arr;
        }
    }
};

exports.filters = filters;

exports.selectKeys = filters.selectKeys;
exports.selectValues = filters.selectValues;

exports.filterObjects = (obj, criteria) => {
    const result = [];
    if (_.isObject(obj) && !Array.isArray(obj)) {
        return _.reduce(obj, (acum, item) => {
            acum.push(criteria(item));
            return acum; //criteria(item);
        }, []);
    } else {
        return obj;
    }
}

exports.filterColumns = (field, type, args, tdid) => {
    if (field) {
        if (type == "dateLocalTime_format") {
            
            let property = _.find(config.aislelabs.properties, (prop) => { return prop.tdid == tdid ; })                   
            return moment(field * 1).tz(property.tz).format(args);            
        }
        if (type == "date_format") {
            //return moment((field * 1) - 18000 * 1000).format(args);
            return moment(field * 1).format(args);
        }

        if (type == "md5") {
            return crypto.createHash('md5').update(field).digest('hex');
        }

        if (type == "pop") {
            return field[0];
        }
    }

    return field;
}

exports.csv = (arr, columnFilters) => {
    log.info('Calling csv with %j', arr, ' and columnFilters: %j', columnFilters);
    let csv = "";
    const maxDimension = _.reduce(arr, (maxRank, item) => {
        const rank = Array.isArray(item) ? item.length : 1;
        return (maxRank < rank) ? rank : maxRank;
    }, 0);

    for (let row = 0; row < maxDimension; row++) {
        for (let col = 0; col < arr.length; col++) {
            let val = Array.isArray(arr[col]) ? arr[col][row] : arr[col];
            if (columnFilters && columnFilters[col] && columnFilters[col].type) {
                var tdidCol = arr[columnFilters[col].tdid];
                var tdid = Array.isArray(tdidCol) ? tdidCol[row] : tdidCol;
                val = exports.filterColumns(val, columnFilters[col].type, columnFilters[col].args, tdid);
            }
            log.info('Calling csv before %s', val);
            val = _.replace(val, /\\t/g, "");
            val = _.replace(val, /\\n/g, "");
            val = _.replace(val, /\\r/g, "");
            val = _.replace(val, /\\\\t/g, "");
            val = _.replace(val, /\\\\n/g, "");
            val = _.replace(val, /\\\\r/g, "");

            log.info('Calling csv after %s', val);
            csv += `"${val}"`;
            if (col < arr.length - 1) {
                csv += ',';
            }
        }
        csv += '\n';
    }

    return csv;
}
exports.upload = (csv, tableInfo) => {
    log.log('Entering helper::upload %s %j', csv, tableInfo);
    return new Promise(function (resolve, reject) {
        if (tableInfo) {
            db.addToTable(tableInfo, csv).then(message => {
                log.log(message);
                db.close().then(() => { resolve(); });
            })
                .catch(e => {
                    db.close().then(() => { reject(e); });
                });
        } else {
            log.error({ errorMessage: 'DB tableInfo is incomplete, skipping DB upload', tableInfo });
            reject('No tableInfo table name, skipping DB upload');
        }
    });
}
