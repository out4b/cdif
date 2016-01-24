var ModuleManager = require('./module-manager');
var RouteManager = require('./lib/route-manager');

var mm = new ModuleManager();
var routeManager = new RouteManager(mm);


routeManager.installRoutes();
mm.loadModules();

// forever to restart on crash?
