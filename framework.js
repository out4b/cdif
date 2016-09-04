var uuid = require('uuid');
var express = require('express');
var app = express();

var ModuleManager = require('./module_manager');
var RouteManager = require('./lib/route-manager');
var DeviceDB = require('./lib/device-db');

//TODO: check port availability
var appPort = 3049;
var deviceMap = [];

var mm = new ModuleManager();
var routeManager = new RouteManager(app);
var deviceDB = new DeviceDB();

routeManager.on('discover', function(reqHandler){
  mm.discoverAllDevices();
  reqHandler.response(200, null);
});

routeManager.on('stopdiscover', function(reqHandler) {
  mm.stopDiscoverAllDevices();
  reqHandler.response(200, null);
});

routeManager.on('devicelist', function(reqHandler) {
  var deviceList = [];
  for (var id in deviceMap) {
    deviceList.push(id);
  }
  reqHandler.response(200, deviceList);
});

routeManager.on('connect', function(reqHandler) {
  var deviceID = reqHandler.req.params.deviceID;
  var device = deviceMap[deviceID];
  if (!device) {
    reqHandler.response(200, 'device not found');
    return;
  }
  if (device.module.discoverState === 'discovering') {
    reqHandler.response(500, 'in discovering');
    return;
  }
  var deviceObj = device.obj;
  //TODO: add auth support
  deviceObj.connect('', '', function(err) {
    if (err) {
      reqHandler.response(500, err);
    } else {
      reqHandler.response(200, null);
    }
  });
});

routeManager.on('disconnect', function(reqHandler) {
  var deviceID = reqHandler.req.params.deviceID;
  var device = deviceMap[deviceID];
  if (!device) {
    reqHandler.response(500, 'device not found');
    return;
  }
  var deviceObj = device.obj;
  deviceObj.disconnect(function(err) {
    if (err) {
      reqHandler.response(500, err);
    } else {
      reqHandler.response(200, null);
    }
  });
});

routeManager.on('actioninvoke', function(reqHandler) {
  var req = reqHandler.req;
  var deviceID = req.params.deviceID;
  //TODO: validate input command schema
  //TODO: input argumentList should contain elements with their valid argument names)
  var serviceId = req.body.serviceId;
  var actionName = req.body.actionName;
  var args = req.body.argumentList;
  var device = deviceMap[deviceID];
  if (!device) {
    reqHandler.response(500, 'device not found');
    return;
  }
  var deviceObj = device.obj;
  if (!deviceObj) {
    reqHandler.response(500, 'device not found');
  } else {
    try {
      deviceObj.deviceControl(serviceId, actionName, args, function(err, ret) {
        if(err) {
          reqHandler.response(500, err.message);
        } else {
          //TODO: update device.states in device model
          reqHandler.response(200, ret);
        }
      });
    } catch (e) {
      reqHandler.response(500, e.message);
    }
  }
});

routeManager.on('getdevicespec', function(reqHandler) {
  var deviceID = reqHandler.req.params.deviceID;
  var device = deviceMap[deviceID];
  if (!device) {
    reqHandler.response(500, 'device not found');
    return;
  }
  var spec = deviceMap[deviceID].spec;
  if (!spec) {
    reqHandler.response(200, '');
  } else {
    reqHandler.response(200, spec);
  }
});

//TODO
function validateDeviceSpec(spec) {

}

function validateClientRequestData(req) {

}

function validateServerResponseData(res) {

}

mm.on('deviceonline', function(discovered, module) {
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

mm.on('deviceoffline', function(device) {
});

function init() {
  try {
    deviceDB.create();
    routeManager.installRoutes();
    mm.loadModules();
  } catch (e) {
    console.error(e);
    process.exit(-1);
  }
}

init();

app.listen(appPort);
