var events = require('events');
var util = require('util');
var Service = require('./service');

//warn: try not add event listeners in this class
function CdifDevice(spec) {
  this.spec = spec;
  this.deviceID = '';
  this.connected = false;
  this.initServices();

  this.getDeviceSpec = this.getDeviceSpec.bind(this);
  this.connect = this.connect.bind(this);
  this.disconnect = this.disconnect.bind(this);
  this.getHWAddress = this.getHWAddress.bind(this);
  this.deviceControl = this.deviceControl.bind(this);
  this.subscribeDeviceEvent = this.subscribeDeviceEvent.bind(this);
  this.unSubscribeDeviceEvent = this.unSubscribeDeviceEvent.bind(this);
}

util.inherits(CdifDevice, events.EventEmitter);


CdifDevice.prototype.setAction = function(serviceID, actionName, action) {
  if (action == null || typeof(action) !== 'function') {
    console.error('set incorrect action type for: ' + serviceID + ' ' + actionName);
    return;
  }
  var service = this.services[serviceID];
  if (service) {
    service.actions[actionName].invoke = action.bind(this);
  } else {
    console.error('cannot set action: ' + serviceID + ' ' + actionName);
  }
};

CdifDevice.prototype.initServices = function() {
  this.services = {};
  var serviceList = this.spec.device.serviceList;
  for (var i in serviceList) {
    var service_spec = serviceList[i];
    this.services[i] = new Service(i, service_spec);
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

CdifDevice.prototype.getServiceStates = function(serviceID, callback) {
  if (callback && typeof(callback) !== 'function') {
    console.error('not valid callback');
    return;
  }
  var service = this.services[serviceID];
  if (service == null) {
    if (callback)
      callback(new Error('service not found: ' + serviceID), null);
    return;
  }
  if (this.connected === false) {
    if (callback)
      callback(new Error('device not connected'), null);
    return;
  }
  service.getServiceStates(callback);
};

CdifDevice.prototype.setServiceStates = function(serviceID, values, callback) {
  if (callback && typeof(callback) !== 'function') {
    console.error('not valid callback');
    return;
  }
  var service = this.services[serviceID];
  if (service == null) {
    if (callback)
      callback(new Error('service not found: ' + serviceID));
    return;
  }
  if (this.connected === false) {
    if (callback)
      callback(new Error('device not connected'));
    return;
  }
  service.setServiceStates(values, callback);
};

CdifDevice.prototype.connect = function(user, pass, callback) {
  var _this = this;
  //TODO: ref count this call?
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
          _this.user = '';
          _this.pass = '';
          _this.connected = true;
        }
        callback(error);
      });
    }
  } else {
    if (this.spec.device.userAuth === true) {
      // TODO: may create auth strategy later on
      callback(new Error('cannot authenticate this device'));
    } else {
      this.connected = true;
      callback(null);
    }
  }
};

CdifDevice.prototype.disconnect = function(callback) {
  var _this = this;
  //TODO: ref count this call?
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
      // if device didn't implement disconnect then we assume it always stays in connected state
      // this is useful for ozw device status update
      // this.connected = false;
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

CdifDevice.prototype.updateDeviceSpec = function(newSpec) {
  this.spec = newSpec;
  this.initServices();
};

CdifDevice.prototype.setEventSubscription = function(serviceID, subscribe, unsubscribe) {
  if (typeof(subscribe) !== 'function' || typeof(unsubscribe) !== 'function') {
    console.error('type error for event subscribers');
    return;
  }
  var service = this.services[serviceID];
  if (service) {
    service.setEventSubscription(subscribe.bind(this), unsubscribe.bind(this));
  } else {
    console.error('cannot set subscriber for: ' + serviceID);
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

CdifDevice.prototype.getDeviceRootUrl = function(callback) {
  if (this.spec.device.devicePresentation !== true || !this._getDeviceRootUrl) {
    callback(new Error(' this device do not support presentation'), null);
    return;
  }
  this._getDeviceRootUrl(callback);
};

module.exports = CdifDevice;
