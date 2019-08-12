'use strict';
const datasources = {};
datasources['meraki'] = require('./meraki.js');
datasources['aislelabs'] = require('./aislelabs.js');

exports.extractFromDefinition = function(definition) {
    if(!definition.extract.source) {
        return datasources['aislelabs'].extractFromDefinition(definition);
    } else {
        return datasources[definition.extract.source].extractFromDefinition(definition);
    }
}
