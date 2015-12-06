var events = require('events');
var util = require('util');

function Service(serviceID, spec) {
  this.serviceID = serviceID;
  this.serviceType = spec.serviceType;
  this.actions = {};
  this.states = {};

  var actionList = spec.actionList;
  for (var i in actionList) {
    var action = actionList[i];
    this.actions[i] = {};
    this.actions[i].args = action.argumentList; // save for validation
    this.actions[i].invoke = null; // to be filled by device modules
  }

  var stateVariables = spec.serviceStateTable;
  for (var i in stateVariables) {
    this.states[i] = {};
    this.states[i].variable = stateVariables[i]; // save for validation
    if (stateVariables[i].hasOwnProperty('defaultValue')) {
      this.states[i].value = stateVariables[i].defaultValue;
    } else {
      this.states[i].value = '';
    }
  }
  this.updateState = this.updateState.bind(this);
}

util.inherits(Service, events.EventEmitter);

Service.prototype.addAction = function(actionName, action) {
  this.actions[actionName].invoke = action;
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

// TODO: add allowed range and data type check
Service.prototype.validate = function(action, args, callback) {
  var argumentList = action.args;
  var failed = false;

  // output args can be null
  for (var i in args) {
    if (argumentList[i] == null) {
      failed = true;
    }
  }
  if (failed) {
    callback(new Error(''), i);
  } else {
    callback(null);
  }
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
    this.validate(action, input, function(err, name) {
      if (err) {
        callback(new Error('action: ' + actionName + ' argument name: ' + name + ' is not valid'), null);
      } else {
        action.invoke(input, function(err, output) {
          if (!err) {
            _this.validate(action, output, function(err, n) {
              if (err) {
                callback(new Error('action: ' + actionName + ' output result name: ' + n + ' is not valid'), null);
              } else {
                _this.updateState(action, input, output, function(updated, data) {
                    _this.emit('serviceevent', updated, data);
                });
                callback(err, output);
              }
            });
          } else {
            callback(err);
          }
        });
      }
    });
  }
};

Service.prototype.setSubscriber = function(subscribeCall) {
  this.subscribe = subscribeCall;
};

Service.prototype.setUnsubscriber = function(unsubscribeCall) {
  this.unsubscribe = unsubscribeCall;
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
