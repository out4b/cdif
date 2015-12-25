var ModuleManager = require('./module-manager');
var DeviceManager = require('./lib/device-manager');
var RouteManager = require('./lib/route-manager');

var mm = new ModuleManager();
var deviceManager = new DeviceManager(mm);
var routeManager = new RouteManager(deviceManager);


routeManager.installRoutes();
routeManager.installHandlers();
mm.loadModules();

// forever to restart on crash?
