'use strict';
require('./tests.spec');
const rewire = require('rewire');
const Promise = require('bluebird');
const expect = require('chai').expect;
const _ = require('lodash');

const transformData = require('./data/transform.js');
const bouncedVisitorsBySpace = require('./data/bounced_visitors_space.json');
let helper = rewire('../tools/helper.js');


describe('helpers tests', function() {
    it('CreateTemplate should create a template properly', (done) => {
        const template = helper.createTemplate('TestDataset', 'col1:STRING,col2:LONG,col3:DECIMAL,col4:DOUBLE,col5:DATE,col6:DATETIME')
        const expectedTemplate = {
            dataSet: {
                name: 'TestDataset',
                rows: 0,
                schema: {
                    columns: [{
                        type: 'STRING',
                        name: 'col1'
                    }, {
                        type: 'LONG',
                        name: 'col2'
                    }, {
                        type: 'DECIMAL',
                        name: 'col3'
                    }, {
                        type: 'DOUBLE',
                        name: 'col4'
                    }, {
                        type: 'DATE',
                        name: 'col5'
                    }, {
                        type: 'DATETIME',
                        name: 'col6'
                    }]
                }
            },
            updateMethod: "APPEND"
        };

        JSON.stringify(template).should.equal(JSON.stringify(expectedTemplate));
        done();
    });

    it('CreateTemplate should handle spaces in parameter list', (done) => {
        const template = helper.createTemplate('TestDataset', 'col1:STRING, col2: LONG,col3:DECIMAL')
        const expectedTemplate = {
            dataSet: {
                name: 'TestDataset',
                rows: 0,
                schema: {
                    columns: [{
                        type: 'STRING',
                        name: 'col1'
                    }, {
                        type: 'LONG',
                        name: 'col2'
                    }, {
                        type: 'DECIMAL',
                        name: 'col3'
                    }]
                }
            },
            updateMethod: "APPEND"
        };

        JSON.stringify(template).should.equal(JSON.stringify(expectedTemplate));
        done();
    });

    it('CreateTemplate should ignore non known types', (done) => {
        const template = helper.createTemplate('TestDataset', 'col1:STRING, col2: LONG,col3:DECIMAL2')
        const expectedTemplate = {
            dataSet: {
                name: 'TestDataset',
                rows: 0,
                schema: {
                    columns: [{
                        type: 'STRING',
                        name: 'col1'
                    }, {
                        type: 'LONG',
                        name: 'col2'
                    }]
                }
            },
            updateMethod: "APPEND"
        };

        JSON.stringify(template).should.equal(JSON.stringify(expectedTemplate));
        done();
    });

    it('getValueFromPath shoud return a proper value given a simple path', (done) => {
        const get = helper.__get__('getValueFromPath');
        const obj = transformData.obj; 

        get(obj, 'a.j').should.equal(2900);
        done();
    });

    it('getValueFromPath shoud return a proper value given a path with an array', (done) => {
        const get = helper.__get__('getValueFromPath');
        const obj = transformData.obj; 
        
        _.isEqual(get(obj, 'a.d'), [1, 2, 3]).should.be.true;
        done();
    });

    it('getValueFromPath shoud return a proper value given a deep path within an array', (done) => {
        const get = helper.__get__('getValueFromPath');
        const obj = transformData.obj; 
        _.isEqual(get(obj, 'a.b[].c[].d.a'), [1, 3, 5, 7]).should.be.true;
        done();
    });

    it('transform shoud return an array with the specified fields', (done) => {
        const transform = helper.transform;
        const obj = transformData.obj;
        const result = transform(obj, 'k,a.j,a.b[].c[].d.a');
        _.isEqual(result, [1000, 2900, [1, 3, 5, 7]]).should.be.true;
        done();
    });
    
    it('transform with complex data', (done) => {
        const transform = helper.transform;
        const obj = bouncedVisitorsBySpace;
        const columns = '@response.everyone,request.tdid,request.ftid,request.fppl,response.everyone,response.visitors,response.uniqVisitors';
        const result = transform(obj, columns, helper.selectValues);
        const expected = [["1481709600000","1481713200000","1481716800000","1481720400000","1481724000000","1481727600000","1481731200000","1481734800000","1481738400000","1481742000000","1481745600000","1481749200000","1481752800000","1481756400000","1481760000000","1481763600000","1481767200000","1481770800000","1481774400000","1481778000000"],"657","10856","B",[0,0,0,0,0,132,360,438,468,462,360,402,276,252,192,114,48,0,0,0],[0,0,0,0,0,132,360,438,468,462,360,402,276,252,192,114,48,0,0,0],[0,0,0,0,0,132,360,438,468,462,360,402,270,246,192,114,48,0,0,0]]; 
        //Datetime  TDID    FTID (Space)    FPPL    Everyone    Visitors    UniqueVisitors
        //console.log('%j', result.join(',') );
        _.isEqual(result, expected).should.be.true;
        done();
    });

    it('Generating a CSV', (done) => {
        const transform = helper.transform;
        const obj = bouncedVisitorsBySpace;
        const columns = '@response.everyone,request.tdid,request.ftid,request.fppl,response.everyone,response.visitors,response.uniqVisitors';
        const transformed = transform(obj, columns, helper.selectValues);
        const csv = helper.csv(transformed);
        //Datetime  TDID    FTID (Space)    FPPL    Everyone    Visitors    UniqueVisitors
        //console.log(csv);
        //_.isEqual(result, expected).should.be.true;
        done();
    });});
