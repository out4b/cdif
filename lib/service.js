var events    = require('events');
var util      = require('util');
var pointer   = require('jsonpointer');
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
      this.actions[i].args = action.argumentList; // save for validation
      this.actions[i].invoke = null; // to be filled by device modules
    }
  }
  var stateVariables = spec.serviceStateTable;
  for (var i in stateVariables) {
    if (!this.states[i]) {
      this.states[i] = {};

      if (stateVariables[i].dataType === 'object') {
        var schemaRef = stateVariables[i].schema;
        if (schemaRef) {
          stateVariables[i].schema = this.resolveSchema(schemaRef);
        }
      }

      this.states[i].variable = stateVariables[i]; // save for validation

      if (stateVariables[i].hasOwnProperty('defaultValue')) {
        this.states[i].value = stateVariables[i].defaultValue;
      } else {
        this.states[i].value = '';
      }
    }
  }
};

// turn json pointer ref to actual schema object
Service.prototype.resolveSchema = function(schemaRef) {
  var schemaDoc = this.device.schemaDoc;
  if (!schemaDoc) return null;

  try {
    var schema = pointer.get(schemaDoc, schemaRef);
    return schema;
  } catch (e) {
    return null;
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

Service.prototype.validate = function(action, arguments, callback) {
  var argList = action.args;
  var failed = false;
  var error = null;

  for (var i in arguments) {
    // argument keys must match spec
    if (!argList[i]) {
      error = new Error('argument name: ' + i + ' is not valid');
      failed = true;
    } else {
      // validate data
      var name = argList[i].relatedStateVariable;
      var stateVar = this.states[name].variable;

      validator.validate(stateVar, arguments[i], function(err) {
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
    if (action.invoke == null) {
      callback(new Error('action: ' + actionName + ' not implemented'), null);
      return;
    }
    this.validate(action, input, function(err) {
      if (err) {
        callback(err, null);
      } else {
        action.invoke(input, function(err, output) {
          if (!err) {
            _this.validate(action, output, function(err) {
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
