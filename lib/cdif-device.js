var events = require('events');
var util = require('util');

function CdifDevice(spec) {
  this.spec = spec;
  this.connected = false;
  this.actions = {};
  var services = spec.device.serviceList;
  for (var i in services) {
    var service = services[i];
    this.actions[i] = {};
    var actions = service.actionList;
    for (var j in actions) {
      this.actions[i][j] = {};
    }
  }
  this.getDeviceSpec = this.getDeviceSpec.bind(this);
  this.connect = this.connect.bind(this);
  this.disconnect = this.disconnect.bind(this);
  this.getHWAddress = this.getHWAddress.bind(this);
  this.deviceControl = this.deviceControl.bind(this);
  this.subscribeDeviceEvent = this.subscribeDeviceEvent.bind(this);
  this.unSubscribeDeviceEvent = this.unSubscribeDeviceEvent.bind(this);
}

util.inherits(CdifDevice, events.EventEmitter);


CdifDevice.prototype.getDeviceSpec = function(callback) {
  if (this.spec == null) {
    callback(new Error('cannot get device spec'), null);
  } else {
    callback(null, JSON.stringify(this.spec));
  }
}

CdifDevice.prototype.connect = function(user, pass, callback) {
  var _this = this;
  if (this._connect) {
    this._connect(user, pass, function(error) {
      if (!error) {
        _this.connected = true;
      }
      callback(error);
    });
  }
}

CdifDevice.prototype.disconnect = function(callback) {
  var _this = this;
  if (this._disconnect) {
    this._disconnect(function(error) {
      if (!error) {
        _this.connected = false;
      }
      callback(error);
    });
  }
}

CdifDevice.prototype.getHWAddress = function(callback) {
  if (this._getHWAddress) {
    this._getHWAddress(function(error, data) {
      callback(error, data);
    });
  }
}

CdifDevice.prototype.deviceControl = function(serviceId, actionName, args, callback) {
  var action = this.actions[serviceId][actionName];
  if (action == null) {
    callback(new Error('action not found: ' + actionName), null);
  } else {
    if (this.connected == false) {
      callback(new Error('device not connected'), null);
      return;
    }
    action(args, function(err, data) {
      callback(err, data);
    });
  }
}

var eventCallback = function(data) {
  console.log(data);
}

CdifDevice.prototype.subscribeDeviceEvent = function(serviceId, callback) {
  if (this.spec.device.serviceList[serviceId] == null) {
    callback(new Error('cannot subscribe to unknown serviceId:' + serviceId));
    return;
  }
  if (this.subscribeEvent) {
    if (this.emitter.listeners(serviceId).length === 0) {
      this.emitter.addListener(serviceId, eventCallback);
    }
    this.subscribeEvent(serviceId, function(err) {
      callback(err);
    });
  }
}

CdifDevice.prototype.unSubscribeDeviceEvent = function(serviceId, callback) {
  if (this.spec.device.serviceList[serviceId] == null) {
    callback(new Error('cannot unsubscribe from unknown serviceId:' + serviceId));
    return;
  }
  if (this.unsubscribeEvent) {
    this.unsubscribeEvent(serviceId, function(err) {
      if (!err) {
        this.emitter.removeListener(serviceId, eventCallback);
      }
      callback(err);
    })
  }
}



module.exports = CdifDevice;
