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
  if (this.connected == false) {
    callback(new Error('device not connected'), null);
    return;
  }
  if (this.spec == null) {
    callback(new Error('cannot get device spec'), null);
  } else {
    console.log('device name: ' + this.spec.device.friendlyName + ' deviceID: ' + this.deviceID);
    callback(null, this.spec);
  }
}

CdifDevice.prototype.getDeviceState = function(serviceID, callback) {
  var service = this.services[serviceID];
  if (service == null) {
    callback(new Error('service not found: ' + serviceID), null);
    return;
  }
  if (this.connected == false) {
    callback(new Error('device not connected'), null);
    return;
  }
  service.getState(callback);
}

CdifDevice.prototype.connect = function(user, pass, callback) {
  var _this = this;
  if (this.connected === true) {
    callback(null);
    return;
  }
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
    this.connected = false;
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

CdifDevice.prototype.deviceControl = function(serviceID, actionName, args, callback) {
  var service = this.services[serviceID];
  if (service == null) {
    callback(new Error('service not found: ' + serviceID), null);
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


CdifDevice.prototype.subscribeDeviceEvent = function(subscriber, serviceID, callback) {
  var service = this.services[serviceID];
  if (service == null) {
    callback(new Error('cannot subscribe to unknown serviceID: ' + serviceID));
    return;
  }
  if (this.connected == false) {
    callback(new Error('device not connected'), null);
    return;
  }
  service.subscribeEvent(subscriber.onChange, function(err) {
    if (!err) {
      service.addListener('serviceevent', subscriber.publish);
    }
    callback(err);
  });
}

CdifDevice.prototype.unSubscribeDeviceEvent = function(subscriber, serviceID, callback) {
  var service = this.services[serviceID];
  if (service == null) {
    callback(new Error('cannot unsubscribe from unknown serviceID: ' + serviceID));
    return;
  }
  if (this.connected == false) {
    callback(new Error('device not connected'), null);
    return;
  }
  service.removeListener('serviceevent', subscriber.publish);
  if (service.listeners('serviceevent').length === 0) {
    service.unsubscribeEvent(function(err) {
      callback(err);
    });
  }
}

module.exports = CdifDevice;
