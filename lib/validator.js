var validator = require('is-my-json-valid');

// TODO: add allowed range check
module.exports = {
  validate: function(varDef, data, callback) {
    var type = varDef.dataType;
    if (!type) {
      callback(new Error('cannot identify variable data type'));
      return;
    }
    switch (type) {
      case 'number':
        // number & integer type may need implicit conversion
        if (typeof(data) != 'number') {
          callback(new Error('data is not a number'));
        } else {
          callback(null);
        }
        break;
      case 'integer':
        if (typeof(data) == 'number' && (data % 1) === 0) {
          callback(null);
        } else {
          callback(new Error('data is not an integer'));
        }
        break;
      case 'string':
        if (typeof(data) !== 'string') {
          callback(new Error('data is not a string'));
        } else {
          callback(null);
        }
        break;
      case 'boolean':
        if (typeof(data) !== 'boolean') {
          callback(new Error('data is not a boolean'));
        } else {
          callback(null);
        }
        break;
      case 'object':
        if (typeof(data) !== 'object' && typeof(data) !== 'array') {
          callback(new Error('data is not a object'));
        } else {
          var schema = varDef.schema;
          if (!schema) {
            callback(new Error('data has no schema'));
          } else {
            // TODO: maybe better to pre-compile the schema
            var validate = validator(schema);
            try {
              if (!validate(data)) {
                callback(new Error('validation failed'));
              } else {
                callback(null);
              }
            } catch (e) {
              callback(e);
            }
          }
        }
        break;
    }
  }
};
