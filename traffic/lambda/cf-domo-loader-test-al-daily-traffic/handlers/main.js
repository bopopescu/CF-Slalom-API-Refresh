'use strict';
const uuid = require('uuid');
const Promise = require('bluebird');
const _ = require('lodash');
const config = require('config');
const data = require('../data_sources/selector.js');
const helpers = require('../tools/helper.js');
const moment = require('moment');
const f = require('../logtools.js').f;
const log = require('../tools/logger.js');
const s3Helper = require('../tools/s3.js');

const AWS = require('aws-sdk');
const lambda = new AWS.Lambda({
    apiVersion: '2015-03-31'
});

function doLoad(kinesisPayload) {
    return new Promise((resolve, reject) => {
        const csvObj = {};
        const readPromises = [];
        const rejectedCsv = [];
        // For each streamid do the load.
        // Commit the execution.
        // if fails, then push it back to the kinesis stream.

        const performRead = Promise.coroutine(function* () {

            for (let i = 0; i < kinesisPayload.Records.length; i++) {
                let payload = new Buffer(kinesisPayload.Records[i].kinesis.data, 'base64').toString();
                try {
                    payload = JSON.parse(payload);
                    log.log({
                        'load': payload
                    });
                } catch (e) {
                    log.error({
                        error: 'Skipping payload because of an exception',
                        e: e,
                        'skippedPayload': payload
                    });
                    continue;
                }
                const newPromise = yield s3Helper.readS3(payload.load.folder, payload.load.filename)
                    .then((data) => {
                        //success
                        log.log({ message: "Got the file object " + payload.load.filename });
                        //convert from buffer to string
                        let fileData = data.toString('latin1');
                        if (!csvObj[payload.load.streamid]) {
                            csvObj[payload.load.streamid] = { data: [fileData], tableInfo: payload.load.tableDescription };
                        } else {
                            csvObj[payload.load.streamid].data.push(fileData);
                        }
                        resolve();
                    })
                    .catch(e => {
                        log.error({ // an error occurred
                            error: 'Error getting s3 data',
                            e: error,
                            stack: error.stack
                        });
                        reject(e);
                    });
                readPromises.push(newPromise);
            }

            Promise.all(readPromises.map(function (p) {
                if (p) {
                    return p.reflect();
                } else {
                    return Promise.resolve().reflect();
                }
            }))
                .each(function (inspection) {
                    if (!inspection.isFulfilled) {
                        // we should put the batch again in the queue
                        rejectedCsv.push(inspection.value);
                    }
                });
            log.log(f({
                message: 'Retrying to load',
                rejectedCsv
            }));
            if (rejectedCsv.length > 0) {
                pushToKinesis(config.kinesis.load, rejectedCsv)
                    .then(() => {
                        resolve();
                    })
                    .catch((e) => {
                        log.error({
                            error: 'Error: Could not push to kinesis. ',
                            e: e
                        });
                        reject(e);
                    });
            }
        });

        // For each streamid do the load.
        // Commit the execution.
        // if fails, then push it back to the kinesis stream.

        const promises = [];

        const performUpload = Promise.coroutine(function* () {
            const streamIds = _.keys(csvObj);
            for (let i = 0; i < streamIds.length; i++) {
                const joinedCSV = _.join(csvObj[streamIds[i]].data, '');
                csvObj[streamIds[i]].data = joinedCSV;
            }
            for (let i = 0; i < streamIds.length; i++) {
                const newPromise = yield helpers.upload(csvObj[streamIds[i]].data, csvObj[streamIds[i]].tableInfo)
                    .then((response) => {
                        log.info({
                            message: 'Record uploaded.'
                        });
                        resolve();
                    })
                    .catch(e => {
                        log.error({
                            message: 'Error in upload',
                            error: e
                        });
                        reject(e);
                    });
                promises.push(newPromise);
            }

            Promise.all(promises.map(function (p) {
                if (p) {
                    return p.reflect();
                } else {
                    return Promise.resolve().reflect();
                }
            }))
                .each(function (inspection) {
                    if (!inspection.isFulfilled) {
                        // we should put the batch again in the queue
                        rejectedCsv.push(inspection.value);
                    }
                });
            log.log(f({
                message: 'Retrying to load',
                rejectedCsv
            }));
            if (rejectedCsv.length > 0) {
                pushToKinesis(config.kinesis.load, rejectedCsv)
                    .then(() => {
                        resolve();
                    })
                    .catch((e) => {
                        log.error({
                            error: 'Error: Could not push to kinesis. ',
                            e: e
                        });
                        reject(e);
                    });
            }
        });


        performRead().then(() => {
            log.info({ message: 'Trying to load records' });
            performUpload();
        });
    });
}

let lastTime;

module.exports.load = (kinesisPayload, context, callback) => {
    doLoad(kinesisPayload)
        .then(() => {
            callback(null, {
                statusCode: 200,
                body: JSON.stringify("Batch records committed")
            });
        })
        .catch((e) => {
            log.error(f({
                error: 'Error in exports.load - doLoad',
                e: e,
                errorWithPayload: kinesisPayload
            }));
            callback(e);
        });
};

module.exports.transform = (payload, context, callback) => {
    log.log({
        message: "Transform invoked ",
        payload
    });
    //Check if skip is enabled for the transform process
    let isSkip = payload.transform.skip;
    let filetype = payload.transform.filetype;
    let objFilter = payload.transform.object_transform;
    let arrFilter = payload.transform.array_transform;
    let afterFilter = payload.transform.after_transform;
    let nested = payload.transform.nested;
    let fileData;
    let dataToUpload;
    s3Helper.readS3(payload.storage.folder,
        payload.storage.filename)
        .then((data) => {
            //success
            log.log({
                message: "Got the file object " + payload.storage.filename
            });
            if (filetype === "csv") {
                //convert from buffer to string
                fileData = data.toString('latin1');
                // remove the column row of the csv to prevent it from going to the DB
                let fileDataArr = fileData.split('\n');
                fileDataArr.shift();
                fileData = fileDataArr.join('\n').toString('latin1');
                log.log(fileData);
            } else if (filetype === "JSON") {
                fileData = JSON.parse(data);
            }
            if (isSkip != "1") {
                if (nested == "1") {
                    const reducedObject = helpers.reduceNesting(fileData,
                        payload.transform.nestedKey,
                        payload.transform.newNestedkey,
                        payload.transform.keepKey);
                    let csv = "";
                    _.forEach(reducedObject, function (value) {
                        const rawdata = helpers.transform(value, payload.transform.columns, objFilter, arrFilter, afterFilter);
                        const csvPart = helpers.csv(rawdata, payload.transform.column_filters);
                        csv += csvPart;
                    });
                    //payload['csv'] = csv;        
                    dataToUpload = csv;
                } else {
                    const rawdata = helpers.transform(fileData, payload.transform.columns, objFilter, arrFilter, afterFilter);
                    log.log({
                        "rawdata before csv transformation": rawdata
                    });
                    const csv = helpers.csv(rawdata, payload.transform.column_filters);

                    log.log({
                        "rawdata after csv transformation": csv
                    });

                    dataToUpload = csv;
                }
            } else {
                dataToUpload = fileData;
            }
            s3Helper.writeS3(dataToUpload,
                payload.load.folder,
                payload.load.filename, (error, response) => {
                    if (error) {
                        return callback({ message: `Error while saving to S3: ${error}` });
                    } else {
                        log.log({
                            message: 'Got response from S3',
                            response: response
                        });
                        pushToKinesis(config.kinesis.load, [payload]);
                        return callback(null);
                    }
                });
        })
        .catch(error => {
            log.error({ // an error occurred
                error: 'Error getting s3 data',
                e: error,
                stack: error.stack
            });
            return callback('Error getting s3 data');
        });

};

module.exports.extract = (kinesisPayload, context, callback) => {
    log.log(f({
        message: "Entering to extract",
        kinesisPayload: kinesisPayload,
        context: context
    }));
    let payload = new Buffer(kinesisPayload.Records[0].kinesis.data, 'base64').toString();
    const parameters = JSON.parse(payload);

    var isSkip = parameters.extract.skip;
    log.log(({
        message: "Skip",
        isSkip
    }));
    let response = {
        statusCode: 200,
        body: JSON.stringify({
            message: "Extract invoked successfully"
        })
    };

    if (isSkip == "1") {
        log.log({
            message: "Skipping the extract process and pushing directly to kinesis",
        });
        invoke(`${config.lambda.prefix}-${process.env.stage}-transform`, parameters)
            .then(() => {
                callback(null, response);
            })
            .catch((e) => {
                log.error({
                    error: 'Error invoking transform',
                    e
                });
                callback(e);
            });
    } else {
        data.extractFromDefinition(parameters)
            .then((extractPayload) => {
                invoke(`${config.lambda.prefix}-${process.env.stage}-transform`, extractPayload)
                    .then(() => {
                        callback(null, response);
                    })
                    .catch((e) => {
                        log.error({
                            error: 'Error invoking transform',
                            e
                        });
                        callback(e);
                    });
            })
            .catch((e) => {
                response.body = JSON.stringify(e);
                log.error({ extractCallError: e });
                if (!parameters['retries']) {
                    parameters['retries'] = 0;
                }
                parameters['retries']++;
                if (parameters['retries'] < process.env.maxretries) {
                    log.log({
                        message: "Retrying because of unsuccessful extract",
                        extractCallError: e,
                        retrying: parameters['retries']
                    });
                    pushToKinesis(config.kinesis.extract, [parameters])
                        .then(() => {
                            callback(null, response);
                        });
                } else {
                    log.error(f({
                        error: "Max amount of retries reached",
                        maxretries: process.env.maxretries,
                        payload: parameters
                    }));
                    response.body = JSON.stringify({
                        message: "Max retries reached"
                    });
                    callback(null, response);
                }
            });
    }
};

function invoke(name, payload) {
    log.log(f({
        message: `Invoking ${name} with payload`,
        payload
    }));
    return new Promise((resolve, reject) => {
        const strPayload = (_.isString(payload)) ? payload : JSON.stringify(payload);
        var params = {
            FunctionName: name,
            ClientContext: '',
            InvocationType: 'Event',
            Payload: strPayload,
        };

        lambda.invoke(params, function (err, data) {
            if (err) {
                log.error({
                    error: 'Error invoking lambda',
                    e: err,
                    stack: err.stack
                }); // an error occurred
            } else {
                log.info({
                    message: 'Invoked with data',
                    data
                }); // successful response
            }
            resolve();
        });
    });
}

function doProcess(confArr, callback) {
    pushToKinesis(config.kinesis.extract, confArr)
        .then(() => {
            callback(null, {
                statusCode: 200,
                body: JSON.stringify({
                    message: "Process schedule finished"
                })
            })

        })
        .catch((e) => {
            log.error({
                error: 'Error in doProcess',
                e
            });
            callback(e);
        });

}

module.exports.doProcess = doProcess;

function pushToKinesis(streamName, confArr) {
    return new Promise((resolve, reject) => {
        const kinesis = new AWS.Kinesis({
            apiVersion: '2013-12-02'
        });

        let records = [];
        let recordsBatch = [];
        const batchSize = 50;

        for (let i = 0; i < confArr.length; i++) {
            const item = JSON.parse(JSON.stringify(confArr[i]));
            const id = (item['id']) ? item['id'] : uuid.v4();

            const partitionKey = (item.shard) ? item.shard : id;
            const record = {
                Data: JSON.stringify(item),
                PartitionKey: partitionKey
            };
            log.info({
                message: 'Record pushed to kinesis',
                record
            });
            records.push(record);

            if (i % batchSize == 0 && i != 0) {
                recordsBatch.push(records);
                records = [];
            }
        }

        if (records.length > 0) {
            recordsBatch.push(records);
        }

        let promiseArr = [];

        for (let r = 0; r < recordsBatch.length; r++) {
            const currentRecords = recordsBatch[r];

            log.info(f({
                message: 'Pushing records to Kinesis',
                records: currentRecords
            }));


            promiseArr.push(new Promise((resolve, reject) => {
                Promise.delay(10000)
                    .then(() => {
                        kinesis.putRecords({
                            Records: currentRecords,
                            StreamName: streamName
                        }, function (err, data) {
                            if (err) {
                                log.error({
                                    error: 'Error in pushToKinesis',
                                    err
                                });
                                reject(err);
                            }
                            log.log(f({
                                message: "Response from Kinesis",
                                responseFromKinesis: data
                            }));

                            if (data && data.FailedRecordCount == 0) {
                                resolve();
                            } else {
                                if (data) {
                                    let rejectedRecords = [];
                                    for (let rr = 0; rr < data.Records.length; rr++) {
                                        if (data.Records[rr].ErrorCode) {
                                            rejectedRecords.push(JSON.parse(currentRecords[rr].Data));
                                        }
                                    }
                                    log.log(f({
                                        message: "Reinjecting failed records",
                                        ReinjectingFailedRecords: rejectedRecords
                                    }));
                                    Promise.delay(20000).then(() => {
                                        pushToKinesis(streamName, rejectedRecords)
                                            .then(() => {
                                                resolve();
                                            });
                                    });
                                } else {
                                    reject("kinesis returned null response");
                                }
                            }
                        });
                    });
            }));
        }

        Promise.all(promiseArr)
            .then(() => {
                resolve();
            })
            .catch((e) => {
                log.error({
                    error: 'Error in pushToKinesis (2)',
                    e
                });
                reject();
            });
    });
}
