var events = require('events');
var util = require('util');

var uuid = require('uuid');
var walk = require('walkdir');
var path = require('path');
//var forever = require('forever-monitor');

var modules = [];
var nmm = null;

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
    modules[name].deviceList = [];
    modules[name].state = 'loaded';
    //module.discoverDevices();
};

ModuleManager.prototype.onModuleUnload = function(name) {
    console.log('module: ' + name + ' unloaded');
    var m = modules[name];
    if (m != null) {
        modules[name].module = null;
        modules[name].deviceList = [];
        modules[name].state = 'unloaded';
    }
};

ModuleManager.prototype.discoverAllDevices = function() {
    var map = modules;

    for (var i in map) {
        if (map[i].state == 'loaded') {
            map[i].module.discoverDevices();
        }
    }
};

ModuleManager.prototype.stopDiscoverAllDevices = function() {
    var map = modules;

    for (var i in map) {
        if (map[i].state == 'loaded') {
            map[i].module.stopDiscoverDevices();
        }
    }
};

ModuleManager.prototype.onDeviceOnline = function(device, module) {
    for (var mname in modules) {
        if (modules[mname].module == module) {
            modules[mname].deviceList.push(device);
            this.emit('deviceonline', device, module);
        }
    }
};

ModuleManager.prototype.onDeviceOffline = function(device, module) {
    // remove from module's device map and emit event to framework
};

function checkModuleExports(module) {
    // TODO: check module actually inherits from EventEmitter
    var proto = module.prototype;
    return proto.hasOwnProperty('discoverDevices');
}

ModuleManager.prototype.loadModules = function() {
    var _mm = this;
    var walker = walk(__dirname + '/modules', {'follow_symlinks': false,'no_recurse': true});

    walker.on('directory', function(name, stat) {
        var module;

        try {
          console.log(name);
            module = require(name);
        } catch (e) {
            console.error('Error load module: ' + name +  ' : ' + e);
        }
        if (module) {
            if (typeof(module) === 'function') {
                if (checkModuleExports(module)) {
                    var m = new module();
                    m.on('deviceonline', _mm.onDeviceOnline.bind(_mm));
                    m.on('deviceoffline', _mm.onDeviceOffline.bind(_mm));
                    _mm.emit('moduleload', name, m);
                }
            } else {
                console.error('expect module: ' + name + ' export constructor');
            }
        }
    });
}

module.exports = ModuleManager;
