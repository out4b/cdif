var events = require('events');
var util = require('util');
var Service = require('./service');

function CdifDevice(spec) {
  this.spec = spec;
  this.connected = false;
  this.services = {};
  var serviceList = spec.device.serviceList;
  for (var i in serviceList) {
    var service_spec = serviceList[i];
    this.services[i] = new Service(i, service_spec);
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
  } else {
    callback(null);
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
  } else {
    callback(null);
  }
}

CdifDevice.prototype.getHWAddress = function(callback) {
  if (this._getHWAddress) {
    this._getHWAddress(function(error, data) {
      callback(error, data);
    });
  } else {
    callback(null, null);
  }
}

CdifDevice.prototype.deviceControl = function(serviceId, actionName, args, callback) {
  var service = this.services[serviceId];
  if (service == null) {
    callback(new Error('service not found: ' + serviceId), null);
    return;
  }
  var action = service.actions[actionName];
  if (action == null) {
    callback(new Error('action not found: ' + actionName), null);
  } else {
    if (action.invoke == null) {
      callback(new Error('action: ' + actionName + ' not implemented'), null);
      return;
    }
    if (this.connected == false) {
      callback(new Error('device not connected'), null);
      return;
    }
    //TODO: validate args
    action.invoke(args, function(err, data) {
      callback(err, data);
    });
  }
}


CdifDevice.prototype.subscribeDeviceEvent = function(serviceId, onChange, callback) {
  var _this = this;
  var service = this.services[serviceId];
  if (service == null) {
    callback(new Error('cannot subscribe to unknown serviceId: ' + serviceId));
    return;
  }
  if (this.connected == false) {
    callback(new Error('device not connected'), null);
    return;
  }
  if (service.subscribeEvent) {
    service.subscribeEvent(onChange, function(err) {
      if (!err) {
        if (service.listeners('serviceevent').length === 0) {
          service.addListener('serviceevent', function(data) {
            console.log(data);
            // _this.emit('deviceevent', data);
          });
        }
      }
      callback(err);
    });
  } else {
    callback(err);
  }
}

CdifDevice.prototype.unSubscribeDeviceEvent = function(serviceId, callback) {
  var service = this.services[serviceId];
  if (service == null) {
    callback(new Error('cannot unsubscribe from unknown serviceId: ' + serviceId));
    return;
  }
  if (this.connected == false) {
    callback(new Error('device not connected'), null);
    return;
  }
  if (service.unsubscribeEvent) {
    service.unsubscribeEvent(function(err) {
      if (!err) {
        service.removeAllListeners('serviceevent');
      }
      callback(err);
    });
  } else {
    callback(null);
  }
}

module.exports = CdifDevice;
