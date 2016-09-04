var events    = require('events');
var util      = require('util');
var parser    = require('json-schema-ref-parser');
var validator = require('./validator');

function Service(device, serviceID, spec) {
  this.device      = device;
  this.serviceID   = serviceID;
  this.serviceType = spec.serviceType;
  this.actions     = {};
  this.states      = {};

  this.updateSpec(spec);
  this.updateState = this.updateState.bind(this);
}

util.inherits(Service, events.EventEmitter);

Service.prototype.addAction = function(actionName, action) {
  this.actions[actionName].invoke = action;
};

Service.prototype.updateSpec = function(spec) {
  var actionList = spec.actionList;
  for (var i in actionList) {
    if (!this.actions[i]) {
      var action = actionList[i];
      this.actions[i] = {};
      this.actions[i].args = JSON.parse(JSON.stringify(action.argumentList)); // save for validation
      this.actions[i].invoke = null; // to be filled by device modules
    }
  }
  var stateVariables = spec.serviceStateTable;
  for (var i in stateVariables) {
    if (!this.states[i]) {
      this.states[i] = {};

      this.states[i].variable = JSON.parse(JSON.stringify(stateVariables[i])); // save for validation

      if (stateVariables[i].dataType === 'object') {
        var schemaRef = stateVariables[i].schema;
        if (schemaRef) {
          this.resolveSchemaRef(schemaRef, i, function(err, name, data) {
            this.states[name].variable.schema = data;
          }.bind(this));
        }
      }

      if (stateVariables[i].hasOwnProperty('defaultValue')) {
        this.states[i].value = stateVariables[i].defaultValue;
      } else {
        this.states[i].value = '';
      }
    }
  }
};

// turn json pointer ref to actual schema object
Service.prototype.resolveSchemaRef = function(schemaRef, name, callback) {
  var schemaDoc = this.device.schemaDoc;
  if (!schemaDoc) {
    callback(new Error('device has no schema doc'), null, null);
    return;
  }
  try {
    schemaDoc = JSON.parse(JSON.stringify(this.device.schemaDoc));
  } catch(e) {
    callback(e, null, null);
    return;
  }

  //FIXME: check schemaRef is a valid JSON pointer
  schemaDoc.__ =  {
    "$ref": '#' + schemaRef
  };

  try {
    parser.dereference(schemaDoc, function(err, out) {
      if (err) {
        callback(err, null, null);
      } else {
        callback(null, name, out.__);
      }
    });
  } catch (e) {
    callback(e, null, null);
  }
};

Service.prototype.getServiceStates = function(callback) {
  var output = {};
  for (var i in this.states) {
    output[i] = this.states[i].value;
  }
  if (callback)
    callback(null, output);
};

Service.prototype.setServiceStates = function(values, callback) {
  var updated = false;
  var sendEvent = false;
  var data = {};

  for (var i in values) {
    if (!this.states[i]) {
      if (callback)
        callback(new Error('set invalid state for variable name: ' + i));
      return;
    }
    if (this.states[i].value !== values[i]) {
      this.states[i].value = values[i];
      updated = true;
    }
    //FIXME: do we report all or only eventable variables?
    // also consider this call could update only part of all states managed by the service
    if (this.states[i].variable.sendEvents === true) {
      data[i] = values[i];
    }
  }
  this.emit('serviceevent', updated, data);
  if (callback)
    callback(null);
};

//TODO: do validation on event data
Service.prototype.updateState = function(action, input, output, callback) {
  var updated = false;
  var data = {};

  for (var i in input) {
    var argument = action.args[i];
    if (argument == null) break;
    var stateVarName = argument.relatedStateVariable;
    if (stateVarName == null) break;
    if (argument.direction === 'in') {
      if (this.states[stateVarName].value !== input[i]) {
        this.states[stateVarName].value = input[i];
        if (this.states[stateVarName].variable.sendEvents === true) {
          updated = true;
        }
      }
    } else if (argument.direction === 'out') {
      if (this.states[stateVarName].value !== output[i]) {
        this.states[stateVarName].value = output[i];
        if (this.states[stateVarName].variable.sendEvents === true) {
          updated = true;
        }
      }
    }
    data[stateVarName] = this.states[stateVarName].value;
  }
  callback(updated, data);
};

Service.prototype.validateActionCall = function(action, arguments, isInput, callback) {
  var argList = action.args;
  var failed = false;
  var error = null;

  // argument keys must match spec
  if (isInput) {
    for (var i in argList) {
      if (arguments[i] == null) {
        failed = true;
        error = new Error('missing argument: ' + i);
        break;
      }
    }
  } else {
    for (var i in argList) {
      if (argList[i].direction === 'out') {
        if (arguments[i] == null) {
          failed = true;
          error = new Error('missing output argument: ' + i);
          break;
        }
      }
    }
  }
  if (failed) {
    callback(error);
    return;
  }
  // validate data
  for (var i in arguments) {
    var name = argList[i].relatedStateVariable;
    var stateVar = this.states[name].variable;

    if (isInput && argList[i].direction === 'out') {
      // only check out args on call return
      continue;
    } else {
      validator.validate(name, stateVar, arguments[i], function(err) {
        if (err) {
          error = err;
          failed = true;
        }
      });
    }
    if (failed) break;
  }
  callback(error);
};

Service.prototype.invokeAction = function(actionName, input, callback) {
  var _this = this;
  var action = this.actions[actionName];

  if (action == null) {
    callback(new Error('action not found: ' + actionName), null);
  } else {
    if (input == null) {
      callback(new Error('cannot identify input arguments'), null);
      return;
    }
    if (action.invoke == null) {
      callback(new Error('action: ' + actionName + ' not implemented'), null);
      return;
    }
    this.validateActionCall(action, input, true, function(err) {
      if (err) {
        callback(err, null);
      } else {
        action.invoke(input, function(err, output) {
          if (!err) {
            _this.validateActionCall(action, output, false, function(err) {
              if (err) {
                callback(err, null);
              } else {
                _this.updateState(action, input, output, function(updated, data) {
                    _this.emit('serviceevent', updated, data);
                });
                callback(null, output);
              }
            });
          } else {
            callback(err, null);
          }
        });
      }
    });
  }
};

Service.prototype.setEventSubscription = function(subscribe, unsubscribe) {
  this.subscribe = subscribe;
  this.unsubscribe = unsubscribe;
};

Service.prototype.subscribeEvent = function(onChange, callback) {
  if (this.subscribe) {
    this.subscribe(onChange, callback);
  } else {
    // we can still send state change events upon action call
    callback(null);
  }
};

Service.prototype.unsubscribeEvent = function(callback) {
  if (this.unsubscribe) {
    this.unsubscribe(callback);
  } else {
    callback(null);
  }
};

module.exports = Service;
