var events = require('events');
var util = require('util');
var uuid = require('uuid');
var DeviceDB = require('./device-db');
var DeviceAuth = require('./device-auth');

function DeviceManager(mm) {
  this.deviceMap = {};
  this.deviceDB = new DeviceDB();
  this.deviceAuth = new DeviceAuth();
  this.moduleManager = mm;

  this.moduleManager.on('deviceonline',  this.onDeviceOnline.bind(this));
  this.moduleManager.on('deviceoffline', this.onDeviceOffline.bind(this));
}

util.inherits(DeviceManager, events.EventEmitter);

DeviceManager.prototype.onDeviceOnline = function(cdifDevice, m) {
  //TODO: validate device spec schema
  var _this = this;
  cdifDevice.module = m;

  cdifDevice.getHWAddress(function(err, addr) {
    var hwAddr;
    var deviceUUID;
    if(!err) {
      hwAddr = addr;
      _this.deviceDB.getDeviceUUIDFromHWAddr(hwAddr, function(err, data) {
        if (err) {
          console.error(err);
          return;
        }
        if (!data) {
          deviceUUID = uuid.v4();
          _this.deviceDB.setDeviceUUID(hwAddr, deviceUUID, function(err) {
            if (err) {
              console.error('cannot insert address record');
              return;
            }
          });
        } else {
          deviceUUID = data.uuid;
        }
        _this.deviceDB.setSpecForDevice(hwAddr, JSON.stringify(cdifDevice.spec));
        cdifDevice.hwAddr = hwAddr;
        cdifDevice.deviceID = deviceUUID;
        _this.deviceMap[deviceUUID] = cdifDevice;
      });
    } else {
      console.error('cannot get HW address for device: ' + cdifDevice.spec.device.friendlyName);
    }
  });
};

DeviceManager.prototype.onDeviceOffline = function(cdifDevice, m) {
  //TODO
};

DeviceManager.prototype.discoverAll = function(callback) {
  this.moduleManager.discoverAllDevices();
  callback(null, null);
};

DeviceManager.prototype.stopDiscoverAll = function(callback) {
  this.moduleManager.stopDiscoverAllDevices();
  callback(null, null);
};

DeviceManager.prototype.getDiscoveredDeviceList = function(callback) {
  var deviceList = {};
  for (var i in this.deviceMap) {
    var cdifDevice = this.deviceMap[i];
    if (cdifDevice.spec) {
      //this is ugly but the easiest way to handle this request
      var desc = JSON.parse(JSON.stringify(cdifDevice.spec));
      desc.device.serviceList = {};
      deviceList[i] = desc;
    }
  }
  callback(null, deviceList);
};

DeviceManager.prototype.connectDevice = function(deviceID, user, pass, callback) {
  var _this = this;
  var cdifDevice = this.deviceMap[deviceID];
  if (!cdifDevice) {
    callback(new Error('device not found'), null);
    return;
  }
  if (cdifDevice.module.discoverState === 'discovering') {
    callback(new Error('in discovering', null));
    return;
  }

  cdifDevice.connect(user, pass, function(err) {
    if (err) {
      callback(err, null);
    } else {
      if (user !== '' && pass !== '') {
        var token = _this.deviceAuth.generateToken(user, pass, function(err, data) {
          if (err) {
            callback(new Error('cannot generate access token'), null);
          } else {
            callback(null, {'access_token': data});
          }
        });
      } else {
        callback(null, null);
      }
      if (cdifDevice.spec.device.devicePresentation === true) {
        _this.emit('presentation', cdifDevice.deviceID);
      }
    }
  });
};

DeviceManager.prototype.disconnectDevice = function(deviceID, token, callback) {
  var cdifDevice = this.deviceMap[deviceID];
  if (!cdifDevice) {
    callback(new Error('device not found'), null);
  } else {
    this.deviceAuth.verifyAccess(cdifDevice, token, function(err) {
      if (err) {
        callback(err, null);
        return;
      }
    });
    cdifDevice.disconnect(function(err) {
      if (err) {
        callback(err, null);
      } else {
        callback(null, null);
      }
    });
  }
};

DeviceManager.prototype.invokeDeviceAction = function(deviceID, serviceID, actionName, args, token, callback) {
  //TODO: validate input command schema
  //TODO: input argumentList should contain elements with their valid argument names)
  var cdifDevice = this.deviceMap[deviceID];
  if (!cdifDevice) {
    callback(new Error('device not found'), null);
  } else {
    this.deviceAuth.verifyAccess(cdifDevice, token, function(err) {
      if (err) {
        callback(err, null);
      } else {
        try {
          cdifDevice.deviceControl(serviceID, actionName, args, callback);
        } catch (e) {
          callback(e, null);
        }
      }
    });
  }
};

DeviceManager.prototype.getDeviceSpec = function(deviceID, token, callback) {
  var cdifDevice = this.deviceMap[deviceID];
  if (!cdifDevice) {
    callback(new Error('device not found'), null);
  }  else {
    this.deviceAuth.verifyAccess(cdifDevice, token, function(err) {
      if (err) {
        callback(err, null);
        return;
      } else {
        cdifDevice.getDeviceSpec(callback);
      }
    });
  }
};


DeviceManager.prototype.getDeviceState = function(deviceID, serviceID, token, callback) {
  var cdifDevice = this.deviceMap[deviceID];
  if (!cdifDevice) {
    callback(new Error('device not found'), null);
  }  else {
    this.deviceAuth.verifyAccess(cdifDevice, token, function(err) {
      if (err) {
        callback(err, null);
        return;
      }
    });
    cdifDevice.getDeviceState(serviceID, callback);
  }
};

DeviceManager.prototype.eventSubscribe = function(subscriber, deviceID, serviceID, token, callback) {
  var cdifDevice = this.deviceMap[deviceID];
  if (!cdifDevice) {
    callback(new Error('device not found'));
  } else {
    this.deviceAuth.verifyAccess(cdifDevice, token, function(err) {
      if (err) {
        callback(err, null);
        return;
      }
    });
    if (cdifDevice.module.discoverState === 'discovering') {
      callback(new Error('in discovering'));
    } else {
      cdifDevice.subscribeDeviceEvent(subscriber, serviceID, function(err) {
        callback(err);
      });
    }
  }
};

DeviceManager.prototype.eventUnsubscribe = function(subscriber, deviceID, serviceID, token, callback) {
  var cdifDevice = this.deviceMap[deviceID];
  if (!cdifDevice) {
    callback(new Error('device not found'));
  } else {
    this.deviceAuth.verifyAccess(cdifDevice, token, function(err) {
      if (err) {
        callback(err, null);
        return;
      }
    });
    cdifDevice.unSubscribeDeviceEvent(subscriber, serviceID, function(err) {
      callback(err);
    });
  }
};

DeviceManager.prototype.getDeviceRootUrl = function(deviceID, callback) {
  var cdifDevice = this.deviceMap[deviceID];
  if (!cdifDevice) {
    callback(new Error('device not found'));
  } else {
    cdifDevice.getDeviceRootUrl(callback);
  }
};

module.exports = DeviceManager;
