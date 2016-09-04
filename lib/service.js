var events = require('events');
var util = require('util');

function Service(serviceId, spec) {

  this.serviceId = serviceId;
  this.serviceType = spec.serviceType;
  this.actions = {};
  this.states = {};
  this.emitOnChange = false;

  var actionList = spec.actionList;
  for (var i in actionList) {
    var action = actionList[i];
    this.actions[i] = {};
    this.actions[i].args = action.argumentList; // save for validation
    this.actions[i].invoke = {}; // to be filled by device modules
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

Service.prototype.sendEvent = function(data) {
  this.emit('serviceevent', data);
}

Service.prototype.addAction = function(actionName, action) {
  this.actions[actionName].invoke = action;
};

Service.prototype.subscribeEvent = function(onChange, callback) {
  this.emitOnChange = onChange;
  if (this.subscribe) {
    this.subscribe(callback);
  } else {
    callback(new Error('cannot subscribe event from serviceId: ' + this.serviceId));
  }
}

Service.prototype.unsubscribeEvent = function(callback) {
  if (this.unsubscribe) {
    this.unsubscribe(callback);
  } else {
    callback(new Error('cannot unsubscribe event from serviceId: ' + this.serviceId));
  }
}

Service.prototype.setEventListener = function(emitter, eventName, handler) {
  emitter.addListener(eventName, handler.bind(this));
}



module.exports = Service;
