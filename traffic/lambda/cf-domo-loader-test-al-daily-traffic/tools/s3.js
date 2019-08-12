'use strict';

const aws = require('aws-sdk');
const s3 = new aws.S3({ apiVersion: '2006-03-01' });
const config = require('config');
const Promise = require('bluebird');
const log = require('./logger.js');

// App variables
const baseURL = config.reports.baseurl;

exports.writeS3 = function(body, folder, fileName, callback) {
  //set S3 bucket name and file name.
  const myBucket = config.s3.bucket;
  const myKey = `${folder}/${fileName}`;
  const params = {
    Bucket: myBucket,
    Key: myKey,
    Body: body
  };
  s3.putObject(params, (err, data) => {
    if (err) {
      return callback(err);
    } else {
      return callback(null, {message: `${myKey} uploaded to s3`});
    }
  });
};

exports.readS3 = function(folder, fileName) {
  return new Promise((resolve, reject) => {
    const myBucket = config.s3.bucket;
    const myKey = `${folder}/${fileName}`;
    const params = {
      Bucket: myBucket,
      Key: myKey
    };
    s3.getObject(params, (err, data) => {
      if (err) {
        reject(err);
      } else {
        log.log({
          message: "Got the file object " + myKey,
          data
        });
        resolve(data.Body);
      }
    });
  });
}
