var events = require('events');
var util = require('util');
var uuid = require('uuid');
var DeviceDB = require('./device-db');

var deviceMap = {};
var deviceDB = new DeviceDB();

function DeviceManager(mm) {
  var _this = this;
  this.moduleManager = mm;

  this.moduleManager.on('deviceoffline', function(cdifDevice) {
  });

  this.moduleManager.on('deviceonline', function(cdifDevice, module) {
    //TODO: validate device spec schema
    var device = {};
    device.module = module;
    device.obj = cdifDevice;

    var hwAddr;
    cdifDevice.getHWAddress(function(err, data) {
      if(!err) {
        hwAddr = data;
      } else {
        console.error('cannot get HW address for device: ' + cdifDevice.spec.device.friendlyName);
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
    cdifDevice.deviceID = deviceUUID;
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
  var deviceList = {};
  for (var i in deviceMap) {
    var device = deviceMap[i];
    var cdifDevice = device.obj;

    if (cdifDevice.spec) {
      //this is ugly but the easiest way assuming devices has built up its spec on discovery
      var desc = JSON.parse(JSON.stringify(cdifDevice.spec));
      desc.device.serviceList = {};
      deviceList[i] = desc;
    }
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
  var cdifDevice = device.obj;
  //TODO: add auth support
  cdifDevice.connect('', '', function(err) {
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
  var cdifDevice = device.obj;
  cdifDevice.disconnect(function(err) {
    if (err) {
      callback(err, null);
    } else {
      callback(null, null);
    }
  });
}

DeviceManager.prototype.invokeDeviceAction = function(deviceID, serviceID, actionName, args, callback) {
  //TODO: validate input command schema
  //TODO: input argumentList should contain elements with their valid argument names)
  var device = deviceMap[deviceID];
  if (!device) {
    callback(new Error('device not found'), null);
    return;
  }
  var cdifDevice = device.obj;
  if (!cdifDevice) {
    callback(new Error('device not found'), null);
  } else {
    try {
      cdifDevice.deviceControl(serviceID, actionName, args, function(err, ret) {
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
  var cdifDevice = device.obj;
  if (!cdifDevice) {
    callback(new Error('device not found'), null);
  }  else {
    cdifDevice.getDeviceSpec(callback);
  }
}

DeviceManager.prototype.eventSubscribe = function(subscriber, deviceID, serviceID, callback) {
  var device = deviceMap[deviceID];
  if (!device) {
    callback(new Error('device not found'));
    return;
  }
  var cdifDevice = device.obj;
  if (!cdifDevice) {
    callback(new Error('device not found'));
  } else {
    if (device.module.discoverState === 'discovering') {
      callback(new Error('in discovering'));
    } else {
      cdifDevice.subscribeDeviceEvent(subscriber, serviceID, function(err) {
        callback(err);
      });
    }
  }
}

DeviceManager.prototype.eventUnsubscribe = function(subscriber, deviceID, serviceID, callback) {
  var device = deviceMap[deviceID];
  if (!device) {
    callback(new Error('device not found'));
    return;
  }
  var cdifDevice = device.obj;
  if (!cdifDevice) {
    callback(new Error('device not found'));
  } else {
    cdifDevice.unSubscribeDeviceEvent(subscriber, serviceID, function(err) {
      callback(err);
    });
  }
}

module.exports = DeviceManager;