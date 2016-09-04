var ModuleManager = require('./module_manager');
var DeviceManager = require('./lib/device-manager');
var RouteManager = require('./lib/route-manager');

var mm = new ModuleManager();
var deviceManager = new DeviceManager(mm);
var routeManager = new RouteManager(deviceManager);

//TODO
function validateDeviceSpec(spec) {

}

function validateClientRequestData(req) {

}

function validateServerResponseData(res) {

}

function init() {
  try {
    routeManager.installRoutes();
    routeManager.installHandlers();
    mm.loadModules();
  } catch (e) {
    console.error(e);
    process.exit(-1);
  }
}

init();
