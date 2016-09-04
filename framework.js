var uuid = require('uuid');
var express = require('express');
var app = express();
var sqlite3 = require('sqlite3');

var ModuleManager = require('./module_manager');
var RouteManager = require('./lib/route-manager');

//TODO: check port availability
var appPort = 3049;
var deviceMap = [];

var mm = new ModuleManager();
var routeManager = new RouteManager(app);

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

var db = new sqlite3.Database('./device_addr.db');




//TODO
function validateDeviceSpec(spec) {

}

function validateClientRequestData(req) {

}

function validateServerResponseData(res) {

}

//TODO: close db on framework exit
db.serialize(function() {
  db.run("CREATE TABLE IF NOT EXISTS device_addr(hwaddr TEXT PRIMARY KEY, uuid TEXT)");
});

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
  db.get("SELECT uuid FROM device_addr WHERE hwaddr = ?", hwAddr, function (err, data) {
    if (err) {
      console.error(err);
      return;
    }
    var deviceUUID;
    if (!data) {
      deviceUUID = uuid.v4();
      db.run("INSERT INTO device_addr(hwaddr, uuid) VALUES (?, ?)", hwAddr, deviceUUID);
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
    routeManager.installRoutes();
    mm.loadModules();
  } catch (e) {
    console.error(e);
    process.exit(-1);
  }
}

init();

app.listen(appPort);
