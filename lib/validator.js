var validator             = require('is-my-json-valid');
var deviceRootSchema      = require('../spec/schema.json');
var deviceSchemaValidator = validator(deviceRootSchema);

module.exports = {
  validate: function(name, varDef, data, callback) {
    var type  = varDef.dataType;
    var range = varDef.allowedValueRange;
    var list  = varDef.allowedValueList;

    var errorMessage = null;

    if (type == null) {  //check null and undefined
      errorMessage = 'cannot identify variable data type';
    }
    if (data === null) {
      errorMessage = 'data must not be NULL';
    }
    if (errorMessage === null) {
      switch (type) {
        case 'number':
          if (typeof(data) !== 'number') {
            errorMessage = 'data is not a number';
          }
          break;
        case 'integer':
          if (typeof(data) !== 'number' || (data % 1) !== 0) {
            errorMessage = 'data is not an integer';
          }
          break;
        case 'string':
          if (typeof(data) !== 'string') {
            errorMessage = 'data is not a string';
          }
          break;
        case 'boolean':
          if (typeof(data) !== 'boolean') {
            errorMessage = 'data is not a boolean';
          }
          break;
        case 'object':
          if (typeof(data) !== 'object' && typeof(data) !== 'array') {
            errorMessage = 'data is not a object';
          } else {
            var schema = varDef.schema;
            if (schema == null) {   // check both null and undefined
              errorMessage = 'data has no schema';
            } else if (typeof(schema) !== 'object') {
              errorMessage = 'schema not resolved yet';
            } else {
              // TODO: maybe better to pre-compile the schema
              var validate = validator(schema);
              try {
                if (!validate(data)) {
                  errorMessage = validate.errors[0].field + ' ' + validate.errors[0].message;
                }
              } catch (e) {
                errorMessage = e.message;
              }
            }
          }
          break;
        default:
          errorMessage = 'unknown data type: ' + type;
          break;
      }
    }
    if (errorMessage === null) {
      if (range) {
        if (data > range.maximum || data < range.minimum) {
          errorMessage = 'data exceeds allowed value range';
        }
      }
      if (list) {
        var matched = false;
        for (var i in list) {
          if (data === list[i]) matched = true;
        }
        if (matched === false) {
          errorMessage = 'cannot find matched value in allowed value list';
        }
      }
    }
    if (errorMessage) {
      callback(new Error('data ' + name + ' validation failed, reason: ' + errorMessage));
    } else {
      callback(null);
    }
  },

  validateDeviceSpec: function(spec, callback) {
    var errorMessage = null;

    try {
      if (!deviceSchemaValidator(spec)) {
        errorMessage = deviceSchemaValidator.errors[0].field + ' ' + deviceSchemaValidator.errors[0].message;
      }
    } catch (e) {
      errorMessage = e.message;
    }

    if (errorMessage) {
      return callback(new Error('device spec validation failed, reason: ' + errorMessage));
    }

    //find all matching relatedStateVariable
    var serviceList = spec.device.serviceList;

    for (var service in serviceList) {
      var stateTable = service.serviceStateTable;
      for (var action in service.actionList) {
        for (var argument in action.argumentList) {
          var stateVariableName = argument.relatedStateVariable;
          if (stateTable[stateVariableName] == null || typeof(stateTable[stateVariableName]) !== 'object') {
            return callback(new Error('device spec validation failed, reason: no matching state variable definition for argument: ' + argument));
          }
        }
      }
    }
    callback(null);
  }
};
