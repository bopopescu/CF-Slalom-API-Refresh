'use strict';
const unirest = require('unirest');
const config = require('config');
const Promise = require('bluebird');
const _ = require('lodash');
const f = require('../logtools.js').f;
const log = require('../tools/logger.js');
const s3Helper = require('../tools/s3.js');

function callURL(segment, queryString) {
    let url = `${config.aislelabs.baseurl}${segment}?${queryString}`;
    return new Promise(function(resolve, reject) {
        log.info({
                message: `Calling url: ${url}`
            });
        unirest.get(url)
            .timeout(300 * 1000)
            .end(function(response) {  
                log.log(f({
                    message: 'Getting response from Aislelabs',
                    response: response
                }));
                if (response.statusCode == 200) {
                    resolve(response);
                } else {
                    reject(response.body);
                }
            })
    });
}

exports.extract = function(endpoint, parametersStr, separator) {
    let queryString = `user_key=${process.env.apikey}`;
    const parameters = parametersStr.split(separator);

    for (let i = 0; i < parameters.length; i++) {
        const pair = parameters[i].split(':');
        queryString = queryString + `&${pair[0]}=${pair[1]}`;
    }

    return callURL(endpoint, queryString);
}

exports.extractFromDefinition = function(definition) {
    log.info(f({
            message: 'Entering to extractFromDefinition (Aislelabs)',
            definition: definition
        }));
    let apikeys = [process.env.apikey, process.env.apikey2];
    let selectedKey = (definition.extract.alternativeKey) ? apikeys[1 * definition.extract.alternativeKey] : apikeys[0];
    let queryString = `user_key=${selectedKey}&`;

    queryString += _.chain(definition.extract.endpoint_parameters)
        .map(function(item, key) {
            return `${key}=${item}`;
        })
        .join('&')
        .value();

    return callURL(definition.extract.endpoint, queryString)
        .then((response) => {
            return new Promise((resolve, reject) => {
                if (response.statusCode != 200) {
                    log.log(response.body);
                    reject({message: `Error during extraction, status code: ${response.statusCode}`});
                } else {
                    //Aislelabs api returns sometimes statuscode 200 with error message Authentication unavailable temporarily
                    // or authentication failed
                    //in such a case, needs to skip uploading to S3 because then the load funtion will keep failing trying to process this file                    
                    if(response.body && response.body.error)
                    {
                        log.log({
                            message: 'AISLELABAPIERROR',
                            response: response.body
                        });

                        reject({message: response.body.error.errorReason});
                    }
                    else
                    {
                    s3Helper.writeS3(JSON.stringify(response.body), definition.storage.folder, 
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
                }
            });
        });
}
