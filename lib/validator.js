var options               = require('../lib/cli-options');
var AJV                   = require('ajv');
var ajv                   = new AJV({schemaId: 'auto', jsonPointers: true});

ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-04.json'));

var deviceRootSchema      = require('../spec/schema.json');
var deviceSchemaValidator = ajv.compile(deviceRootSchema);

module.exports = {
  getSchemaValidator: function() {
    return ajv;
  },

  validate: function(name, varDef, data, callback) {
    var type  = varDef.dataType;
    var range = varDef.allowedValueRange;
    var list  = varDef.allowedValueList;

    var errorMessage = null;
    var errorInfo    = null;

    if (type == null) {  //check null and undefined
      errorMessage = '非法变量类型'; errorInfo = name;
    }
    if (data === null) {
      errorMessage = '空数据'; errorInfo = name;
    }
    if (errorMessage === null) {
      switch (type) {
        case 'number':
          if (typeof(data) !== 'number') {
            errorMessage = '数据不是number类型'; errorInfo = name;
          }
          break;
        case 'integer':
          if (typeof(data) !== 'number' || (data % 1) !== 0) {
            errorMessage = '数据不是integer类型'; errorInfo = name;
          }
          break;
        case 'string':
          if (typeof(data) !== 'string') {
            errorMessage = '数据不是string类型'; errorInfo = name;
          }
          break;
        case 'boolean':
          if (typeof(data) !== 'boolean') {
            errorMessage = '数据不是boolean类型'; errorInfo = name;
          }
          break;
        case 'object':
          if (typeof(data) !== 'object' && !Array.isArray(data)) {
            errorMessage = '数据不是object类型'; errorInfo = name;
          } else {
            var schema = varDef.schema;
            if (schema == null) {   // check both null and undefined
              errorMessage = '数据没有schema对象'; errorInfo = name;
            } else if (typeof(schema) !== 'object') {
              errorMessage = '数据schema对象非法'; errorInfo = name;
            } else {
              var validator = varDef.validator;
              if (validator == null) {
                errorMessage = 'schema校验器不可用'; errorInfo = name;
              } else {
                try {
                  if (!validator(data)) {
                    errorMessage = '数据校验失败';
                    errorInfo    = this.getValidatorErrorInfo(validator.errors[0]);
                  }
                } catch (e) {
                  errorMessage = '数据校验异常'; errorInfo = name + e.message;
                }
              }
            }
          }
          break;
        default:
          errorMessage = '数据校验失败'; errorInfo = name + '未知数据类型: ' + type;
          break;
      }
    }
    if (errorMessage === null) {
      if (range) {
        if (data > range.maximum || data < range.minimum) {
          errorMessage = '数据超过允许范围'; errorInfo = name;
        }
      }
      if (list) {
        var matched = false;
        for (var i in list) {
          if (data === list[i]) matched = true;
        }
        if (matched === false) {
          errorMessage = '数据不在允许列表中'; errorInfo = name;
        }
      }
    }
    callback(errorMessage, errorInfo);
  },

  getValidatorErrorInfo: function(error) {
    return {dataPath: error.dataPath, schemaPath: error.schemaPath, validatorMessage: error.message};
  },

  validateDeviceSpec: function(spec, callback) {
    var errorMessage = null;

    try {
      if (!deviceSchemaValidator(spec)) {
        errorMessage = deviceSchemaValidator.errors[0].message;
      }
    } catch (e) {
      errorMessage = e.message;
    }

    if (errorMessage) {
      return callback(new Error('device spec validation failed, reason: ' + errorMessage));
    }

    //find all matching relatedStateVariable
    var serviceList = spec.device.serviceList;

    for (var serviceID in serviceList) {
      var service = serviceList[serviceID];
      var stateTable = service.serviceStateTable;
      var actionList = service.actionList;

      for (var actionName in actionList) {
        var action = actionList[actionName];

        if (options.allowSimpleType !== true) {
          if (Object.keys(action.argumentList).length > 2) {
            return callback(new Error('argumentList cannot contain arguments other than input and output. Service: ' + serviceID + ', action: ' + actionName));
          }
          if (action.argumentList.input == null) {
            return callback(new Error('missing input argument. Service: ' + serviceID + ', action: ' + actionName));
          }
          if (action.argumentList.output == null) {
            return callback(new Error('missing output argument. Service: ' + serviceID + ', action: ' + actionName));
          }
        }

        for (var argumentName in action.argumentList) {
          var argument          = action.argumentList[argumentName];
          var stateVariableName = argument.relatedStateVariable;
          var stateVariable     = stateTable[stateVariableName];

          if (stateVariable == null || typeof(stateVariable) !== 'object') {
            return callback(new Error('device spec validation failed, no matching state variable definition for service: ' + serviceID + ', action: ' + actionName + ', argument: ' + argumentName));
          }
          if (stateVariable.dataType !== 'object' && options.allowSimpleType !== true) {
            return callback(new Error('state variable dataType must be object. Service: ' + serviceID + ' State variable name: ' + stateVariableName));
          }
        }
      }
    }
    callback(null);
  }
};
