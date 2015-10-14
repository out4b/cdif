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
}

util.inherits(Service, events.EventEmitter);

Service.prototype.addAction = function(actionName, action) {
  this.actions[actionName].invoke = action;
};

Service.prototype.invokeAction = function(actionName, args, callback) {
  var action = this.actions[actionName];
  if (action == null) {
    callback(new Error('action not found: ' + actionName), null);
  } else {
    if (action.invoke == null) {
      callback(new Error('action: ' + actionName + ' not implemented'), null);
      return;
    }
    //TODO: validate args
    action.invoke(args, function(err, data) {
      callback(err, data);
    });
  }
}

Service.prototype.sendEvent = function(data) {
  var updated = false;
  for (var i in data) {
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
