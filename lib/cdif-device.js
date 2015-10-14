var events = require('events');
var util = require('util');
var Service = require('./service');

function CdifDevice(spec) {
  this.spec = spec;
  this.deviceID = '';
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
  if (this.connected == false) {
    callback(new Error('device not connected'), null);
    return;
  }
  service.invokeAction(actionName, args, function(err, data) {
    callback(err, data);
  });
}


CdifDevice.prototype.subscribeDeviceEvent = function(subscriber, serviceId, callback) {
  var service = this.services[serviceId];
  if (service == null) {
    callback(new Error('cannot subscribe to unknown serviceId: ' + serviceId));
    return;
  }
  if (this.connected == false) {
    callback(new Error('device not connected'), null);
    return;
  }
  service.subscribeEvent(subscriber.onChange, function(err) {
    if (!err) {
      service.addListener('serviceevent', subscriber.onEvent);
    }
    callback(err);
  });
}

CdifDevice.prototype.unSubscribeDeviceEvent = function(subscriber, serviceId, callback) {
  var service = this.services[serviceId];
  if (service == null) {
    callback(new Error('cannot unsubscribe from unknown serviceId: ' + serviceId));
    return;
  }
  if (this.connected == false) {
    callback(new Error('device not connected'), null);
    return;
  }
  service.unsubscribeEvent(function(err) {
    if (!err) {
        service.removeListener('serviceevent', subscriber.onEvent);
    }
    callback(err);
  });
}

module.exports = CdifDevice;
