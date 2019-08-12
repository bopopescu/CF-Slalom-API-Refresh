'use strict';
const unirest = require('unirest');
const config = require('config');
const Promise = require('bluebird');
const f = require('../logtools.js').f;
const format = require('string-format');
const _ = require('lodash');
const log = require('../tools/logger.js');
const timeout = 300 * 1000;
const s3Helper = require('../tools/s3.js');


function callURL(segment) {
    let url = `${config.meraki.baseurl}${segment}`;
    let apikey = process.env.merakikey;

    return new Promise(function (resolve, reject) {
        log.log({
            message: `Calling url: ${url}`
        });
        unirest.get(url)
            .headers({
                'X-Cisco-Meraki-API-Key': apikey,
                'Content-Type': 'application/json'
            })
            .timeout(timeout)
            .end(function (response) {
                log.log({
                    message: 'Got response from Cisco Meraki',
                    response: response
                });
                resolve(response);
            })
    });
}

exports.extractFromDefinition = function (definition) {
    log.log(f({
        message: 'Entering to extractFromDefinition (Cisco Meraki)',
        definition: definition
    }));
    let segment = format(definition.extract.endpoint, definition.extract.endpoint_parameters);
    log.log(segment);
    return callURL(segment)
        .then((response) => {
            return new Promise((resolve, reject) => {
                if (response.statusCode != 200) {
                    log.log(response.body);
                    reject({message: `Error during extraction, status code: ${response.statusCode}`});
                } else {
                    s3Helper.writeS3(JSON.stringify(response.body), 
                                    definition.storage.folder, 
                                    definition.storage.filename, (error, response) => {
                        if (error) {
                            reject({message: `Error while saving to S3: ${error}`});
                        } else {
                            log.log({
                                message: 'Got response from S3',
                                response: response
                            });
                            resolve(definition);
                        }
                    });
                }
            });
        });
}
