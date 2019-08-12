'use strict';

const aws = require('aws-sdk');
const s3 = new aws.S3({ apiVersion: '2006-03-01' });
const https = require('https');
const config = require('config');
const moment = require('moment-timezone');
const Promise = require('bluebird');
const log = require('../tools/logger.js');

// App variables
const baseURL = config.reports.baseurl;

exports.uploadReport = function(fileName, reportName) {
  //Construct file URL based on the file name
  var fileURL = `${baseURL}/${fileName}`;
  log.log(fileURL);

  //set S3 bucket name and file name.
  var myBucket = config.s3.bucket;
  var myKey = `${reportName}/${fileName}`;

  return new Promise(
    function(resolve, reject) {
    //Send request
    https.get(fileURL, (res) => {
      var body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', function () {
        // Once you received all chunks, send to S3
        const params = {
          Bucket: myBucket,
          Key: myKey,
          Body: body
        };

        //Only upload to s3 when status code in not 4xx
        if (!(res.statusCode >= 400)) {
          s3.putObject(params, function (err, data) {
            if (err) {
              reject(err);
            } else {
              resolve({message: `${myKey} uploaded to s3`});
            }
          });
        } else {
          reject({message: `${fileName} not found`});
        }

        res.on('error', e => {
          log.error('error uploading report', e);
          reject(e);
        })
      });
    }).on('error', (e) => {
      log.error('error uploading report', e);
      reject(e);
    });
  });
};

exports.getS3Data = function(key, callback) {
  const bucket = config.s3.bucket;
  const params = {
    Bucket: bucket,
    Key: key
  };

  return new Promise(
    function(resolve, reject) {
      s3.getObject(params, (err, data) => {
        if (err) {
            const message = `Error getting object ${key} from bucket ${bucket}. Make sure they exist and your bucket is in the same region as this function.`;
            reject(message);
        } else {
          resolve(data.Body.toString('utf-8'));
        }
      });
  });
}
