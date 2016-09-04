var events      = require('events');
var util        = require('util');
var validator   = require('./validator');
var CdifError   = require('./error').CdifError;
var DeviceError = require('./error').DeviceError;

function Service(device, serviceID, spec) {
  this.device      = device;
  this.serviceID   = serviceID;
  this.serviceType = spec.serviceType;
  this.actions     = {};
  this.states      = {};

  this.updateSpec(spec);
  this.updateStateFromAction = this.updateStateFromAction.bind(this);
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
      this.actions[i].invoke = null;              // to be filled by device modules
    }
  }

  // TODO: to save memory usage we can reclaim spec object and dynamically reconstruct it on get-spec call
  var stateVariables = spec.serviceStateTable;
  for (var i in stateVariables) {
    if (!this.states[i]) {
      this.states[i] = {};

      if (stateVariables[i].dataType === 'object') {
        this.states[i].variable = JSON.parse(JSON.stringify(stateVariables[i])); // save for schema deref

        var schemaRef = stateVariables[i].schema;
        if (schemaRef != null) {
          var self = this.states[i].variable;
          this.device.resolveSchemaFromPath(schemaRef, self, function(err, s, data) {
            if (!err) {
              s.schema = JSON.parse(JSON.stringify(data)); // reclaim doc object
            } // or else this is still a pointer
          });
        }
      } else {
        this.states[i].variable = stateVariables[i];
      }

      //TODO: need to deep clone this if we reclaim spec obj
      if (stateVariables[i].hasOwnProperty('defaultValue')) {
        this.states[i].value = stateVariables[i].defaultValue;
      } else {
        this.states[i].value = '';
      }
    }
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
  var _this = this;
  var errorMessage = null;
  var updated = false;
  var sendEvent = false;
  var data = {};

  if (typeof(values) !== 'object') {
    errorMessage = 'event data must be object';
  } else {
    for (var i in values) {
      if (this.states[i] === undefined) {
        errorMessage = 'set invalid state for variable name: ' + i;
        break;
      }
    }
  }

  if (errorMessage === null) {
    for (var i in values) {
      validator.validate(i, this.states[i].variable, values[i], function(err) {
        if (!err) {
          if (typeof(values[i]) === 'object') {
            if (JSON.stringify(values[i]) !== JSON.stringify(_this.states[i].value)) {
              updated = true;
              _this.states[i].value = JSON.parse(JSON.stringify(values[i]));
            }
          } else {
            if (_this.states[i].value !== values[i]) {
              _this.states[i].value = values[i];
              updated = true;
            }
          }
        } else {
          errorMessage = err.message;
        }
      });
      if (errorMessage) break;

      // report only eventable data
      if (this.states[i].variable.sendEvents === true) {
        if (typeof(values[i]) === 'object') {
          data[i] = JSON.parse(JSON.stringify(values[i]));
        } else {
          data[i] = values[i];
        }
      }
    }
  }

  if (errorMessage) {
    if (callback)
      callback(new CdifError('setServiceStates error: ' + errorMessage));
  } else {
    this.emit('serviceevent', updated, data);
    if (callback)
      callback(null);
  }
};

Service.prototype.updateStateFromAction = function(action, input, output, callback) {
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
    } else {
      //TODO: the doc spec schema check should make sure this never happens
      console.error('unknown type of argument: ' + i);
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
      if (arguments[i] === undefined) {
        failed = true;
        error = new CdifError('missing argument: ' + i);
        break;
      }
    }
  } else {
    for (var i in argList) {
      if (argList[i].direction === 'out') {
        if (arguments[i] === undefined) {
          failed = true;
          error = new CdifError('missing output argument: ' + i);
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
          error = new CdifError(err.message);
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

  if (action === undefined) {
    callback(new CdifError('action not found: ' + actionName), null);
  } else {
    if (input === undefined) {
      callback(new CdifError('cannot identify input arguments'), null);
      return;
    }
    if (action.invoke === null) {
      callback(new DeviceError('action: ' + actionName + ' not implemented'), null);
      return;
    }
    this.validateActionCall(action, input, true, function(err) {
      if (err) {
        callback(err, null);
      } else {
        action.invoke(input, function(err, output) {
          if (!err) {
            _this.validateActionCall(action, output, false, function(error) {
              if (error) {
                callback(error, null);
              } else {
                _this.updateStateFromAction(action, input, output, function(updated, data) {
                    _this.emit('serviceevent', updated, data);
                });
                callback(null, output);
              }
            });
          } else {
            callback(new DeviceError(err.message), null);
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
    this.subscribe(onChange, function(err) {
      if (err) {
        callback(new DeviceError('event subscription failed: ' + err.message));
      } else {
        callback(null);
      }
    });
  } else {
    // we can still send state change events upon action call
    callback(null);
  }
};

Service.prototype.unsubscribeEvent = function(callback) {
  if (this.unsubscribe) {
    this.unsubscribe(function(err) {
      if (err) {
        callback(new DeviceError('event unsubscription failed: ' + err.message));
      } else {
        callback(null);
      }
    });
  } else {
    callback(null);
  }
};

module.exports = Service;
