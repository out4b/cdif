var validator = require('is-my-json-valid');

// TODO: add allowed range check
module.exports = {
  validate: function(varDef, data, callback) {
    var type  = varDef.dataType;
    var error = null;

    if (!type) {
      error = new Error('cannot identify variable data type');
    }
    switch (type) {
      case 'number':
        // number & integer type may need implicit conversion
        if (typeof(data) != 'number') {
          error = new Error('data is not a number');
        }
        break;
      case 'integer':
        if (typeof(data) != 'number' && (data % 1) !== 0) {
          error = new Error('data is not an integer');
        }
        break;
      case 'string':
        if (typeof(data) !== 'string') {
          error = new Error('data is not a string');
        }
        break;
      case 'boolean':
        if (typeof(data) !== 'boolean') {
          error = new Error('data is not a boolean');
        }
        break;
      case 'object':
        if (typeof(data) !== 'object' && typeof(data) !== 'array') {
          error = new Error('data is not a object');
        } else {
          var schema = varDef.schema;
          if (!schema) {
            error = new Error('data has no schema');
          } else {
            // TODO: maybe better to pre-compile the schema
            var validate = validator(schema);
            try {
              if (!validate(data)) {
                var errorMessage = validate.errors[0].field + ' ' + validate.errors[0].message;
                error = new Error(errorMessage);
              }
            } catch (e) {
              error = e;
            }
          }
        }
        break;
    }
    if (error) {
      callback(new Error('data validation failed, reason: ' + error.message));
      return;
    }
  }
};
