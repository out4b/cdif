var events      = require('events');
var util        = require('util');
var options     = require('../lib/cli-options');
var exec        = require('child_process').exec;
var deviceDB    = require('../lib/device-db');
var CdifError   = require('../lib/error').CdifError;
var logger      = require('../lib/logger');
var semver      = require('semver');

function ModuleManager() {
  this.modules = {};

  this.on('moduleload', this.onModuleLoad.bind(this));
  this.on('moduleunload', this.onModuleUnload.bind(this));
}

util.inherits(ModuleManager, events.EventEmitter);

ModuleManager.prototype.onModuleLoad = function(name, module, version) {
  logger.info('module: ' + name + '@' + version + ' loaded');

  module.discoverState = 'stopped';

  var m = this.modules[name];
  if (m != null) {
    // module reloaded
    if (m.discoverState === 'discovering') {
      m.discoverState = 'stopped';
    }
    this.emit('purgedevice', m); // to be handled by device manager
  }
  this.modules[name] = module;

  if (options.allowDiscover === false) {
    module.emit('discover');
    setTimeout(function() {
      this.emit('stopdiscover');
    }.bind(module), 5000);
  }
};

ModuleManager.prototype.onModuleUnload = function(name) {
  logger.info('module: ' + name + ' unloaded');

  var m = this.modules[name];
  if (m != null) {
    if (m.discoverState === 'discovering') {
      m.discoverState = 'stopped';
    }
    delete this.modules[name];
    this.emit('purgedevice', m); // to be handled by device manager
  }
};

ModuleManager.prototype.discoverAllDevices = function() {
  for (var m in this.modules) {
    var module = this.modules[m];
    if (module.discoverState === 'discovering') {
      return;
    }
    module.emit('discover');
    module.discoverState = 'discovering';
  }
};

ModuleManager.prototype.stopDiscoverAllDevices = function() {
  for (var m in this.modules) {
    var module = this.modules[m];
    if (module.discoverState === 'stopped') {
      return;
    }
    module.emit('stopdiscover');
    module.discoverState = 'stopped';
  }
};

ModuleManager.prototype.onDeviceOnline = function(device, module) {
  this.emit('deviceonline', device, module);
};

ModuleManager.prototype.onDeviceOffline = function(device, module) {
  this.emit('deviceoffline', device, module);
};

ModuleManager.prototype.loadAllModules = function() {
  deviceDB.getAllModuleInfo(function(err, data) {
    if (err) {
      return logger.error(err);
    }

    if (data == null) return;

    data.forEach(function(item) {
      var mod = null;
      try {
        mod = require(item.name);
      } catch (e) {
        return logger.error(e);
      }

      var m = new mod();
      m.on('deviceonline',  this.onDeviceOnline.bind(this));
      m.on('deviceoffline', this.onDeviceOffline.bind(this));
      this.emit('moduleload', item.name, m, item.version);
    }.bind(this));
  }.bind(this));

  // load any local module specified on command line
  if (options.localModulePath != null) {
    logger.info('load local module from path: ' + options.localModulePath);

    try {
      var moduleConstructor = require(options.localModulePath);
      var moduleInstance    = new moduleConstructor();

      moduleInstance.on('deviceonline',  this.onDeviceOnline.bind(this));
      moduleInstance.on('deviceoffline', this.onDeviceOffline.bind(this));
      this.emit('moduleload', options.localModulePath, moduleInstance, 'local'); // local module won't need version info

    } catch (e) {
      return logger.error('local module load failed: ' + options.localModulePath + ', error: ' + e.message, null);
    }
  }
};

ModuleManager.prototype.loadModule = function(name, version) {
  var moduleConstructor = null;
  var moduleInstance    = null;

  try {
    moduleConstructor = require(name);
    moduleInstance    = new moduleConstructor();
  } catch (e) {
    return logger.error(e);
  }

  moduleInstance.on('deviceonline',  this.onDeviceOnline.bind(this));
  moduleInstance.on('deviceoffline', this.onDeviceOffline.bind(this));
  this.emit('moduleload', name, moduleInstance, version);
};

ModuleManager.prototype.unloadModule = function(name) {
  this.emit('moduleunload', name);
};

//TODO: check module validness, e.g. name start with cdif
ModuleManager.prototype.installModuleFromRegistry = function(registry, name, version, callback) {
  if ((registry != null) && (typeof(registry) !== 'string' ||
    ((/^http:\/\/.{1,256}$/.test(registry) ||
     /^https:\/\/.{1,256}$/.test(registry)) === false))) {
    return callback(new CdifError('module install: invalid registry name'));
  }

  if (name == null || typeof(name) !== 'string') {
    return callback(new CdifError('invalid package name'));
  }

  if (typeof(version) !== 'string' || semver.valid(version) == null) {
    return callback(new CdifError('invalid package version: ' + version));
  }

  var command = null;
  if (registry == null) {
    command = 'npm install ' + name + '@' + version;
  } else {
    command = 'npm install ' + '--registry=' + registry + ' ' + name + '@' + version;
  }

  try {
    exec(command, {timeout: 60000}, function(err, stdout, stderr) {
      if (err) {
        logger.error('module install failed: ' + name + ', error: ' + err.message);
        return callback(new CdifError('module install failed: ' + name + ', error: ' + err.message), null);
      }

      logger.info('module installed: ' + name + '@' + version);

      this.addModuleInformation(name, version, function(e) {
        if (e) {
          return callback(new CdifError('add module record failed: ' + name + ', error: ' + e.message), null);
        }
        this.loadModule(name, version);
        return callback(null);
      }.bind(this));
    }.bind(this));
  } catch (e) {
    return callback(new CdifError('module install failed: ' + name + ', error: ' + e.message), null);
  }
};

ModuleManager.prototype.uninstallModule = function(name, callback) {
  if (name == null || typeof(name) !== 'string') {
    return callback(new CdifError('invalid package name'));
  }

  var command = 'npm uninstall ' + name;

  try {
    exec(command, {timeout: 60000}, function(err, stdout, stderr) {
      if (err) {
        logger.error('module uninstall failed: ' + name + ', error: ' + err.message);
        return callback(new CdifError('module uninstall failed: ' + name + ', error: ' + err.message), null);
      }

      logger.info('module uninstalled: ' + name);

      this.removeModuleInformation(name, function(e) {
        if (e) {
          return callback(new CdifError('remove module record failed: ' + name + ', error: ' + e.message), null);
        }
        this.unloadModule(name);
        return callback(null);
      }.bind(this));
    }.bind(this));
  } catch (e) {
    return callback(new CdifError('module uninstall failed: ' + name + ', error: ' + e.message), null);
  }
};

ModuleManager.prototype.addModuleInformation = function(name, version, callback) {
  if (version === '') version = 'latest';

  deviceDB.setModuleInfo(name, version, function(err) {
    if (err) {
      return callback(new Error('cannot set module info in db: ' + err.message));
    }
    return callback(null);
  }.bind(this));
};

ModuleManager.prototype.removeModuleInformation = function(name, callback) {
  deviceDB.removeModuleInfo(name, function(err) {
    if (err) {
      return callback(new Error('cannot remove module info in db: ' + err.message));
    }
    return callback(null);
  }.bind(this));
};

module.exports = ModuleManager;
