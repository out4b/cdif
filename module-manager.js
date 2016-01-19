var events = require('events');
var util = require('util');
var supported_modules = require('./modules.json');

//var forever = require('forever-monitor');

var modules = {};

function ModuleManager() {
  this.on('moduleload', this.onModuleLoad.bind(this));
  this.on('moduleunload', this.onModuleUnload.bind(this));
}

util.inherits(ModuleManager, events.EventEmitter);

ModuleManager.prototype.onModuleLoad = function(name, module) {
  console.log('module: ' + name + ' loaded');
  var m = modules[name];
  if (m == null) {
    modules[name] = {};
  }
  modules[name].module = module;
  modules[name].state = 'loaded';
  //module.discoverDevices();
};

ModuleManager.prototype.onModuleUnload = function(name) {
  console.log('module: ' + name + ' unloaded');
  var m = modules[name];
  if (m != null) {
    modules[name].module = null;
    modules[name].state = 'unloaded';
  }
};

ModuleManager.prototype.discoverAllDevices = function() {
  var map = modules;

  for (var i in map) {
    if (map[i].state === 'loaded') {
      map[i].module.discoverDevices();
    }
  }
};

ModuleManager.prototype.stopDiscoverAllDevices = function() {
  var map = modules;

  for (var i in map) {
    if (map[i].state === 'loaded') {
      map[i].module.stopDiscoverDevices();
    }
  }
};

ModuleManager.prototype.onDeviceOnline = function(device, module) {
  this.emit('deviceonline', device, module);
};

ModuleManager.prototype.onDeviceOffline = function(device, module) {
  this.emit('deviceoffline', device, module);
};

function checkModuleExports(module) {
  // TODO: check module actually inherits from EventEmitter
  var proto = module.prototype;
  return proto.hasOwnProperty('discoverDevices');
}

ModuleManager.prototype.loadModules = function() {
  var _mm = this;

  supported_modules.forEach(function(item) {
    var mod = require(item);
    var m = new mod();
    m.on('deviceonline', _mm.onDeviceOnline.bind(_mm));
    m.on('deviceoffline', _mm.onDeviceOffline.bind(_mm));
    _mm.emit('moduleload', item, m);
  });
}

module.exports = ModuleManager;
