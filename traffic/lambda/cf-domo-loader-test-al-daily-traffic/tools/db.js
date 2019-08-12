const log = require('./logger.js');
const f = require('../logtools.js').f;
const _ = require('lodash');
var moment = require('moment-timezone');
const Promise = require('bluebird');

let knex = {};

const typeMap = {
    DATE: (table, name) => { table.date(name); },
    DATETIME: (table, name) => { table.dateTime(name); },
    LONG: (table, name) => { table.integer(name); },
    DECIMAL: (table, name) => { table.float(name); },
    STRING: (table, name) => { table.string(name); }
};

function createTable(tableInfo) {
    const tableName = tableInfo.name;
    const tableFields = tableInfo.fields.split(',');

    return knex.schema.createTable(tableName,
        (table) => {
            let primaryColumns = [];

            _.each(tableFields, (field) => {
                const pair = field.split(':');
                const name = pair[0].trim();
                const type = pair[1].trim();

                // add primary columns to array
                if (pair[2]) {
                  primaryColumns.push(name);
                }

                typeMap[type](table, name);
            });

            table.dateTime('updatedAt').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));

            // make composite primary key with listed columns
            if (primaryColumns.length > 0) {
              table.primary(primaryColumns);
            }
        }
    );
}

function insert(tableInfo, csv) {
    const lines = csv.split(/[\r\n]+/);
    const tableName = tableInfo.name;
    const tableFields = tableInfo.fields.split(',');
    const rows = [];
    const fieldNames = [];
    const fieldTypes = [];
    const insertArr = [];

    let query = '';
    let onDuplicate = ` ON DUPLICATE KEY UPDATE `;
    let onDuplicateArray = [];
    let rowCounter = 0;
    let arrayCounter = 1;
    rows.push([]);

    _.each(tableFields, (field, fieldsIndex) => {
        const pair = field.split(':');
        const name = pair[0];
        const fieldType = pair[1];
        const isPrimary = pair[2];

        fieldNames.push(name);
        fieldTypes.push(fieldType);

        // add updateable columns to the array for adding to the query later
        if (!isPrimary) {
          onDuplicateArray.push(`\`${name}\`=VALUES(\`${name}\`)`);
        }
    })

    _.each(lines, (line, lineIndex) => {
        const values = line.split(/","/);
        const row = {};
        let index = 0;

        // protect against empty rows
        if (values.length === fieldNames.length || values.length > 1) {
          _.each(values, (v, valueIndex) => {
            // protect against bad csv data
            if (valueIndex < fieldNames.length) {
              const fieldName = fieldNames[index];
              let convertedVal = v.replace(/^["]{1}/, '').replace(/["]{1}$/, '');

              if (fieldTypes[index] === "DATE") {
                convertedVal = moment(convertedVal).format('YYYY-MM-DD').toString();
              } else if (fieldTypes[index] === "DATETIME") {
                convertedVal = moment(convertedVal).format('YYYY-MM-DD HH:mm:ss').toString();
              }

              row[fieldName] = convertedVal;
              index++;
            }
          });
          
          // batch 2500 DB uploads at a time
          if (rowCounter < 2500 * arrayCounter) {
            rows[arrayCounter - 1].push(row);
          } else {
            rows.push([]);
            arrayCounter++;
            rows[arrayCounter - 1].push(row);
          }
          rowCounter++;
        }
    });

    // add all updateable columns to the end of ON DUPLICATE KEY UPDATE string
    _.each(onDuplicateArray, (dup, dupIndex) => {
      if (dupIndex !== onDuplicateArray.length - 1) {
        onDuplicate += `${dup}, `;
      } else {
        onDuplicate += `${dup}`;
      }
    });

    for (rowArr of rows) {
      // get the SQL query that was made for inserting all the rows
      query = knex(tableName).insert(rowArr).toString();

      // remove extra semi-colon at the end of the query if it exists
      query = query.replace(/;$/, '');

      if (tableInfo.no_upsert) {
        onDuplicate = '';
      }

      // concat the query with the ON DUPLICATE KEY UPDATE string
      query = `${query} ${onDuplicate};`;
      insertArr.push(knex.raw(query));
      log.log({"INSERT Query": query});
    }

    return Promise.all(insertArr);
}

module.exports.addToTable = function (tableInfo, csv) {
    log.log("Start of addToTable");

    knex = require('knex')({
      client: 'mysql',
      connection: {
          host: process.env.dbhost,
          user: process.env.dbuser,
          password: process.env.dbpassword,
          database: process.env.dbname
      }
    });

    const tableName = tableInfo.name;
    const tableFields = tableInfo.fields;

    return knex.schema.hasTable(tableName).then(
        (doesExists) => {
            if (!doesExists) {
                return createTable(tableInfo).then(() => {
                    log.log(`Table ${tableName} successfully created`);
                    return insert(tableInfo, csv);
                })
                .catch(e => {
                  log.log({
                    error: e
                  });

                  return e;
                });
            } else {
                return insert(tableInfo, csv);
            }
      });
}

module.exports.close = function () {
    log.log("Destroying Knex");
    return knex.destroy();
}