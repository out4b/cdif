var ModuleManager = require('./lib/module-manager');
var RouteManager  = require('./lib/route-manager');
var argv          = require('minimist')(process.argv.slice(1));
var options       = require('./lib/cli-options');
var logger        = require('./lib/logger');
var deviceDB      = require('./lib/device-db');

global.CdifUtil = require('./lib/cdif-util');
global.CdifDevice = require('./lib/cdif-device');

logger.createLogger();
options.setOptions(argv);
deviceDB.init();

var mm = new ModuleManager();
var routeManager = new RouteManager(mm);


routeManager.installRoutes();
mm.loadAllModules();


// forever to restart on crash?
