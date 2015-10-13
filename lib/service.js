function Service(serviceId, spec) {

  this.serviceId = serviceId;
  this.serviceType = spec.serviceType;
  this.actions = {};
  this.states = {};
  this.eventSubscribers = [];

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
  var changed = false;
  for (var i in data) {
    if (data[i] != this.states[i]) {
      this.states[i] = data[i];
      changed = true;
    }
  }
  this.eventSubscribers.forEach(function(subscriber) {
    if (changed || subscriber.onChange == false) {
      subscriber.emit('event', data);
    }
  });
}

Service.prototype.subscribeEvent = function(subscriber, callback) {
  var _this = this;
  if (this.subscribe) {
    this.subscribe(function(err) {
      if (!err) {
        _this.eventSubscribers.push(subscriber);
        callback(null);
      } else {
        callback(new Error('cannot subscribe to serviceId: ' + this.serviceId + ' reason: ' + err.message));
      }
    });
  } else {
    callback(new Error('serviceId: ' + this.serviceId + 'has no subscribe interface'));
  }
};

Service.prototype.unsubscribeEvent = function(subscriber, callback) {
  var eventSubscribers = this.eventSubscribers;
  if (this.unsubscribe) {
    this.unsubscribe(function(err) {
      if(!err) {
        for (var i in eventSubscribers) {
          if (eventSubscribers[i] == subscriber) {
            eventSubscribers.splice(i, 1);
          }
        }
        callback(null);
      } else {
        callback(new Error('cannot unsubscribe from serviceId: ' + this.serviceId + ' reason: ' + err.message));
      }
    });
  } else {
    callback(new Error('serviceId: ' + this.serviceId) + 'has no unsubscribe interface');
  }
};



module.exports = Service;
