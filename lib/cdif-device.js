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
  this.on('specupdate', this.onSpecUpdate.bind(this));
}

util.inherits(CdifDevice, events.EventEmitter);

CdifDevice.prototype.setAction = function(serviceID, actionName, action, callback) {
  var service = this.services[serviceID];
  if (service) {
    service.actions[actionName].invoke = action.bind(this);
  } else {
    console.error('cannot set action: ' + serviceID + ' ' + actionName);
  }
};

CdifDevice.prototype.getDeviceSpec = function(callback) {
  if (this.connected === false) {
    callback(new Error('device not connected'), null);
    return;
  }
  if (this.spec == null) {
    callback(new Error('cannot get device spec'), null);
  } else {
    console.log('device name: ' + this.spec.device.friendlyName + ' deviceID: ' + this.deviceID);
    callback(null, this.spec);
  }
};

CdifDevice.prototype.getDeviceState = function(serviceID, callback) {
  var service = this.services[serviceID];
  if (service == null) {
    callback(new Error('service not found: ' + serviceID), null);
    return;
  }
  if (this.connected === false) {
    callback(new Error('device not connected'), null);
    return;
  }
  service.getState(callback);
};

CdifDevice.prototype.connect = function(user, pass, callback) {
  var _this = this;
  if (this.connected === true) {
    if (this.spec.device.userAuth === true) {
      if (this.user === user && this.pass === pass) {
        callback (null);
      } else {
        callback (new Error('user not authenticated'));
      }
      return;
    } else {
      callback(null);
      return;
    }
  }
  if (this._connect) {
    if (this.spec.device.userAuth === true) {
      this._connect(user, pass, function(error) {
        if (!error) {
          _this.user = user;
          _this.pass = pass;
          _this.connected = true;
        }
        callback(error);
      });
    } else {
      this._connect('', '', function(error) {
        if (!error) {
          _this.connected = true;
        }
        callback(error);
      });
    }
  } else {
    if (this.spec.device.userAuth === true) {
      // TODO: add auth strategy later on
      this.user = '';
      this.pass = '';
    }
    this.connected = true;
    callback(null);
  }
};

CdifDevice.prototype.disconnect = function(callback) {
  var _this = this;
  if (this.connected === true) {
    if (this._disconnect) {
      this._disconnect(function(error) {
        if (!error) {
          if (_this.spec.device.userAuth === true) {
            _this.user = ''; _this.pass = '';
          }
          _this.connected = false;
        }
        callback(error);
      });
    } else {
      if (this.spec.device.userAuth === true) {
        this.user = ''; this.pass = '';
      }
      this.connected = false;
      callback(null);
    }
  } else {
    callback(new Error('device not connected'));
  }
};

CdifDevice.prototype.getHWAddress = function(callback) {
  if (this._getHWAddress) {
    this._getHWAddress(function(error, data) {
      callback(error, data);
    });
  } else {
    callback(null, null);
  }
};

CdifDevice.prototype.deviceControl = function(serviceID, actionName, args, callback) {
  var service = this.services[serviceID];
  if (service == null) {
    callback(new Error('service not found: ' + serviceID), null);
    return;
  }
  if (this.connected === false) {
    callback(new Error('device not connected'), null);
    return;
  }
  service.invokeAction(actionName, args, function(err, data) {
    callback(err, data);
  });
};

CdifDevice.prototype.onSpecUpdate = function(newSpec) {
  this.spec = newSpec;
  //rebuild services
  // console.log(JSON.stringify(this.spec));
  this.services = {};
  var serviceList = this.spec.device.serviceList;
  for (var i in serviceList) {
    var service_spec = serviceList[i];
    this.services[i] = new Service(i, service_spec);
  }
};

CdifDevice.prototype.setSubscriber = function(serviceID, subscribeCall, onEvent) {
  var service = this.services[serviceID];
  if (service) {
    service.setSubscriber(subscribeCall.bind(this), onEvent);
  } else {
    console.error('cannot set subscriber: ' + serviceID);
  }
};

CdifDevice.prototype.setUnsubscriber = function(serviceID, unsubscribeCall) {
  var service = this.services[serviceID];
  if (service) {
    service.setUnsubscriber(unsubscribeCall.bind(this));
  } else {
    console.error('cannot set unsubscriber: ' + serviceID);
  }
};

CdifDevice.prototype.subscribeDeviceEvent = function(subscriber, serviceID, callback) {
  var service = this.services[serviceID];
  if (service == null) {
    callback(new Error('cannot subscribe to unknown serviceID: ' + serviceID));
    return;
  }
  if (this.connected === false) {
    callback(new Error('device not connected'), null);
    return;
  }
  service.subscribeEvent(subscriber.onChange, function(err) {
    if (!err) {
      service.addListener('serviceevent', subscriber.publish);
    }
    callback(err);
  });
};

CdifDevice.prototype.unSubscribeDeviceEvent = function(subscriber, serviceID, callback) {
  var service = this.services[serviceID];
  if (service == null) {
    callback(new Error('cannot unsubscribe from unknown serviceID: ' + serviceID));
    return;
  }
  if (this.connected === false) {
    callback(new Error('device not connected'), null);
    return;
  }
  service.removeListener('serviceevent', subscriber.publish);
  if (service.listeners('serviceevent').length === 0) {
    service.unsubscribeEvent(function(err) {
      callback(err);
    });
  }
};

module.exports = CdifDevice;
