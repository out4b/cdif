var uuid = require('uuid');
var DeviceDB = require('./device-db');

var deviceMap = [];
var deviceDB = new DeviceDB();

function DeviceManager(mm) {
  this.moduleManager = mm;

  this.moduleManager.on('deviceoffline', function(device) {
  });

  this.moduleManager.on('deviceonline', function(discovered, module) {
    var spec = null;
    discovered.getDeviceSpec(function(err, data){
      if (!err) {
        console.log(data);
        spec = JSON.parse(data);
      }
    });
    //TODO: validate device spec schema
    var device = {};
    device.spec = spec;
    device.module = module;
    device.obj = discovered;
    device.states = {};

    if (spec == null) return;

    var services = spec.device.serviceList;
    for (var i in services) {
      var service = services[i];
      device.states[i] = {};
      var stateVariables = service.serviceStateTable;
      for (var j in stateVariables) {
        if (stateVariables[j].hasOwnProperty('defaultValue')) {
          device.states[i][j] = stateVariables[j].defaultValue;
        } else {
          device.states[i][j] = '';
        }
      }
    }

    var hwAddr;
    if (!spec.device.UDN) {
      discovered.getHWAddress(function(err, data) {
        if(!err) {
          hwAddr = data;
        } else {
          console.error('cannot get HW address for device' + discovered);
        }
      });
    } else {
      hwAddr = spec.device.UDN;
    }
    deviceDB.getDeviceUUIDFromHWAddr(hwAddr, function(err, data) {
      if (err) {
        console.error(err);
        return;
      }
      var deviceUUID;
      if (!data) {
        deviceUUID = uuid.v4();
        deviceDB.insertRecord(hwAddr, deviceUUID);
      } else {
        deviceUUID = data.uuid;
      }
      deviceMap[deviceUUID] = device;
      console.log("device name: " + spec.device.friendlyName + '\t' + "UUID: " + deviceUUID);
    });
  });
}

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
          //TODO: update device.states in device model
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
  var spec = deviceMap[deviceID].spec;
  if (!spec) {
    callback(null, '');
  } else {
    callback(null, spec);
  }
}

module.exports = DeviceManager;
