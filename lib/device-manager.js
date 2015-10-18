var events = require('events');
var util = require('util');
var uuid = require('uuid');
var DeviceDB = require('./device-db');

var deviceMap = {};
var deviceDB = new DeviceDB();

function DeviceManager(mm) {
  var _this = this;
  this.moduleManager = mm;

  this.moduleManager.on('deviceoffline', function(deviceObj) {
  });

  this.moduleManager.on('deviceonline', function(deviceObj, module) {
    //TODO: validate device spec schema
    var device = {};
    device.module = module;
    device.obj = deviceObj;

    var hwAddr;
    deviceObj.getHWAddress(function(err, data) {
      if(!err) {
        hwAddr = data;
      } else {
        console.error('cannot get HW address for device: ' + deviceObj);
      }
    });

    var deviceUUID;
    deviceDB.getDeviceUUIDFromHWAddr(hwAddr, function(err, data) {
      if (err) {
        console.error(err);
        return;
      }
      if (!data) {
        deviceUUID = uuid.v4();
        deviceDB.insertRecord(hwAddr, deviceUUID);
      } else {
        deviceUUID = data.uuid;
      }
      deviceMap[deviceUUID] = device;
    });
    deviceObj.deviceID = deviceUUID;
  });
}

util.inherits(DeviceManager, events.EventEmitter);

DeviceManager.prototype.discoverAll = function(callback) {
  this.moduleManager.discoverAllDevices();
  callback(null, null);
}

DeviceManager.prototype.stopDiscoverAll = function(callback) {
  this.moduleManager.stopDiscoverAllDevices();
  callback(null, null);
}

DeviceManager.prototype.getDiscoveredDeviceList = function(callback) {
  var deviceList = [];
  for (var id in deviceMap) {
    deviceList.push(id);
  }
  callback(null, deviceList);
}

DeviceManager.prototype.connectDevice = function(deviceID, callback) {
  var device = deviceMap[deviceID];
  if (!device) {
    callback(new Error('device not found'), null);
    return;
  }
  if (device.module.discoverState === 'discovering') {
    callback(new Error('in discovering', null));
    return;
  }
  var deviceObj = device.obj;
  //TODO: add auth support
  deviceObj.connect('', '', function(err) {
    if (err) {
      callback(err, null);
    } else {
      callback(null, null);
    }
  });
}

DeviceManager.prototype.disconnectDevice = function(deviceID, callback) {
  var device = deviceMap[deviceID];
  if (!device) {
    callback(new Error('device not found'));
    return;
  }
  var deviceObj = device.obj;
  deviceObj.disconnect(function(err) {
    if (err) {
      callback(err, null);
    } else {
      callback(null, null);
    }
  });
}

DeviceManager.prototype.invokeDeviceAction = function(deviceID, serviceId, actionName, args, callback) {
  //TODO: validate input command schema
  //TODO: input argumentList should contain elements with their valid argument names)
  var device = deviceMap[deviceID];
  if (!device) {
    callback(new Error('device not found'), null);
    return;
  }
  var deviceObj = device.obj;
  if (!deviceObj) {
    callback(new Error('device not found'), null);
  } else {
    try {
      deviceObj.deviceControl(serviceId, actionName, args, function(err, ret) {
        if(err) {
          callback(err, null);
        } else {
          callback(null, ret);
        }
      });
    } catch (e) {
      callback(e, null);
    }
  }
}

DeviceManager.prototype.getDeviceSpec = function(deviceID, callback) {
  var device = deviceMap[deviceID];
  if (!device) {
    callback(new Error('device not found'), null);
    return;
  }
  var deviceObj = device.obj;
  if (!deviceObj) {
    callback(new Error('device not found'), null);
  }  else {
    deviceObj.getDeviceSpec(callback);
  }
}

DeviceManager.prototype.eventSubscribe = function(subscriber, deviceID, serviceId, callback) {
  var device = deviceMap[deviceID];
  if (!device) {
    callback(new Error('device not found'));
    return;
  }
  var deviceObj = device.obj;
  if (!deviceObj) {
    callback(new Error('device not found'));
  } else {
    if (device.module.discoverState === 'discovering') {
      callback(new Error('in discovering'));
    } else {
      deviceObj.subscribeDeviceEvent(subscriber, serviceId, function(err) {
        callback(err);
      });
    }
  }
}

DeviceManager.prototype.eventUnsubscribe = function(subscriber, deviceID, serviceId, callback) {
  var device = deviceMap[deviceID];
  if (!device) {
    callback(new Error('device not found'));
    return;
  }
  var deviceObj = device.obj;
  if (!deviceObj) {
    callback(new Error('device not found'));
  } else {
    deviceObj.unSubscribeDeviceEvent(subscriber, serviceId, function(err) {
      callback(err);
    });
  }
}

module.exports = DeviceManager;
