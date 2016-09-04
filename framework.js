var uuid = require('uuid');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var sqlite3 = require('sqlite3');
var morgan = require('morgan');
var ModuleManager = require('./module_manager');

//TODO: check port availability
var appPort = 3049;

var discoverRoute = '/discover';
var stopDiscoverRoute = '/stop-discover';
var deviceListRoute = '/device-list';
var deviceControlRoute = '/device-control';
var connectRoute = '/connect';
var disconnectRoute = '/disconnect';
var controlRoute  = '/device-control';
var actionInvokeRoute = '/invoke-action';
var eventSubRoute    = '/event-sub';
var getDeviceSpecRoute = '/get-spec';



var mm = new ModuleManager();
var deviceMap = [];

var db = new sqlite3.Database('./device_addr.db');

var discoverRouter = express.Router();
var stopDiscoverRouter = express.Router();
var deviceListRouter = express.Router();
var deviceControlRouter = express.Router();
var connectRouter = express.Router({mergeParams: true});
var disconnectRouter = express.Router({mergeParams: true});
var actionInvokeRouter = express.Router({mergeParams: true});
var getDeviceSpecRouter = express.Router({mergeParams: true});

discoverRouter.route('/').post(function(req, res) {
  mm.discoverAllDevices();
  res.sendStatus(200);
});

stopDiscoverRouter.route('/').post(function(req, res) {
  mm.stopDiscoverAllDevices();
  res.sendStatus(200);
});


deviceListRouter.route('/').get(function(req, res) {
  var deviceList = [];
  for (var id in deviceMap) {
    deviceList.push(id);
  }
  res.status(200).send(JSON.stringify(deviceList));
});

connectRouter.route('/').post(function(req, res) {
  var deviceID = req.params.deviceID;
  var device = deviceMap[deviceID];
  if (!device) {
    res.status(500).send(JSON.stringify('device not found'));
    return;
  }
  var deviceObj = device.obj;
  //TODO: add auth support
  deviceObj.connect('', '', function(err) {
    if (err) {
      res.status(500).send(JSON.stringify(err));
    } else {
      res.sendStatus(200);
    }
  });
});

disconnectRouter.route('/').post(function(req, res) {
  var deviceID = req.params.deviceID;
  var device = deviceMap[deviceID];
  if (!device) {
    res.status(500).send(JSON.stringify('device not found'));
    return;
  }
  var deviceObj = device.obj;
  deviceObj.disconnect(function(err) {
    if (err) {
      res.status(500).send(JSON.stringify(err));
    } else {
      res.sendStatus(200);
    }
  });
});


//TODO: all get* request should take GET method, so framework no need to call device api each time, instead return framework's cached device states to client
// after doing this, framework would query device *only* if a state table entry is empty, this can happen on framework startup or device reboot and when a state variable doesn't have defaultValue
// and after doing this, there is no need to validate output schema, just validate the return values from a device get call can successfully update an entry in framework's state table
//TODO: check output schema (output object should contain elements with their valid argument names and what returned to client should have retval property)

actionInvokeRouter.route('/').post(function(req, res) {
  var deviceID = req.params.deviceID;
  //TODO: validate input command schema
  //TODO: input argumentList should contain elements with their valid argument names)
  var serviceId = req.body.serviceId;
  var actionName = req.body.actionName;
  var args = req.body.argumentList;
  var device = deviceMap[deviceID];
  if (!device) {
    res.status(500).send(JSON.stringify('device not found'));
    return;
  }
  var deviceObj = device.obj;
  if (!deviceObj) {
    res.status(500).send(JSON.stringify('device not found'));
  } else {
    try {
      deviceObj.deviceControl(serviceId, actionName, args, function(err, ret) {
        if(err) {
          res.status(500).send(JSON.stringify(err));
        } else {
          //TODO: update device.states in device model
          res.status(200).send(JSON.stringify(ret));
        }
      });
    } catch (e) {
      res.status(500).send(JSON.stringify(e.message));
    }
  }
});

getDeviceSpecRouter.route('/').get(function(req, res) {
  var deviceID = req.params.deviceID;
  var device = deviceMap[deviceID];
  if (!device) {
    res.status(500).send(JSON.stringify('device not found'));
    return;
  }
  var spec = deviceMap[deviceID].spec;
  res.status(200).send(spec);
});

app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(discoverRoute, discoverRouter);
app.use(stopDiscoverRoute, stopDiscoverRouter);
app.use(deviceListRoute, deviceListRouter);
app.use(deviceControlRoute, deviceControlRouter);
deviceControlRouter.use('/:deviceID/connect', connectRouter);
deviceControlRouter.use('/:deviceID/disconnect', disconnectRouter);
deviceControlRouter.use('/:deviceID/invoke-action', actionInvokeRouter);
deviceControlRouter.use('/:deviceID/get-spec', getDeviceSpecRouter);


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
  if (spec == null) return;

  var device = {};
  device.spec = spec;
  device.module = module;
  device.obj = discovered;

  device.states = {};
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
    mm.loadModules();
  } catch (e) {
    console.error(e);
    process.exit(-1);
  }
}

init();

app.listen(appPort);
