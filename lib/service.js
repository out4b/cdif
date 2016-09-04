var events = require('events');
var util = require('util');

function Service(serviceId, spec) {
  this.serviceId = serviceId;
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
        if (this.states[stateVarName].variable.sendEvents == true) {
          updated = true;
        }
      }
    } else if (argument.direction === 'out') {
      if (this.states[stateVarName].value !== output[i]) {
        this.states[stateVarName].value = output[i];
        if (this.states[stateVarName].variable.sendEvents == true) {
          updated = true;
        }
      }
    }
    if (updated) {
      data[stateVarName] = this.states[stateVarName].value;
    }
  }
  if (updated) {
    callback(data);
  }
}

Service.prototype.validate = function(action, args, callback) {
  var argumentList = action.args;

  for (var i in args) {
    if (argumentList[i] == null) {
      callback(new Error(''), i);
    }
  }
}

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
    //TODO: validate args and output has valid name and map to valid state var
    this.validate(action, input, function(err, name){
      if (err) {
        callback(new Error('action: ' + actionName + 'argument name: ' + name + ' is not valid'), null);
        return;
      }
    });

    action.invoke(input, function(err, output) {
      if (!err) {
        _this.validate(action, output, function(err, name) {
          if (err) {
            callback(new Error('action: ' + actionName + 'output result name: ' + name + ' is not valid'), null);
            return;
          }
        });
        _this.updateState(action, input, output, function(data) {
            _this.emit('serviceevent', true, data);
        });
      }
      callback(err, output);
    });
  }
}

Service.prototype.sendEvent = function(data) {
  var updated = false;
  for (var i in data) {
    if (this.states[i] == null) {
      // any better way to handle this?
      console.error(this.servicId + ' sending unkown data: ' + i);
      return;
    }
    // probably no need to conform to sendEvents: true flag here...
    if (data[i] != this.states[i].value) {
      this.states[i].value = data[i];
      updated = true;
    }
  }
  this.emit('serviceevent', updated, data);
}

Service.prototype.subscribeEvent = function(onChange, callback) {
  if (this.subscribe) {
    this.subscribe(onChange, function(err) {
      callback(err);
    });
  } else {
    // we can still send state change events upon action call
    callback(null);
  }
};

Service.prototype.unsubscribeEvent = function(callback) {
  if (this.unsubscribe) {
    this.unsubscribe(function(err) {
      callback(err);
    });
  } else {
    callback(null);
  }
};

module.exports = Service;
