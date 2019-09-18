var sqlite3  = require('sqlite3');
var options  = require('./cli-options');
var mkdirp   = require('mkdirp');
var fs       = require('fs');
var logger   = require('./logger');

module.exports = {
  getDeviceUUIDFromHWAddr: function(hwAddr, callback) {
    if (options.localDBAccess === false) return callback(null, null);

    if (hwAddr == null) {
      return callback(null, null);
    }

    this.db.serialize(function() {
      this.db.get("SELECT uuid FROM device_db WHERE hwaddr = ?", hwAddr, callback);
    }.bind(this));
  },

  setDeviceUUID: function(hwAddr, deviceUUID, callback) {
    if (options.localDBAccess === false) return callback(null, null);

    if (hwAddr == null) {
      return callback(null, null);
    }

    this.db.serialize(function() {
      this.db.run("INSERT OR REPLACE INTO device_db(hwaddr, uuid, spec) VALUES (?, ?, (SELECT spec FROM device_db WHERE hwaddr = ?))",
      hwAddr, deviceUUID, hwAddr, callback);
    }.bind(this));
  },

  getDeviceSpecFromHWAddr: function(hwAddr, callback) {
    if (options.localDBAccess === false) return callback(null);

    this.db.serialize(function() {
      this.db.get("SELECT spec FROM device_db WHERE hwaddr = ?", hwAddr, callback);
    }.bind(this));
  },

  setSpecForDevice: function(hwAddr, spec) {
    if (options.localDBAccess === false) return;

    if (hwAddr == null) return;

    this.db.serialize(function() {
      this.db.run("INSERT OR REPLACE INTO device_db(hwaddr, uuid, spec) VALUES (?, (SELECT uuid FROM device_db WHERE hwaddr = ?), ?)",
      hwAddr, hwAddr, spec);
    }.bind(this));
  },

  getSpecForAllDevices: function(callback) {
    if (options.localDBAccess === false) return callback(null, null);

    this.db.parallelize(function() {
      this.db.all("SELECT spec FROM device_db", callback);
    }.bind(this));
  },

  deleteDeviceInformation: function(hwAddr, callback) {
    if (options.localDBAccess === false) return callback(null);

    this.db.serialize(function() {
      this.db.run("DELETE FROM device_db WHERE hwaddr = ?", hwAddr, callback);
    }.bind(this));
  },

  loadSecret: function(deviceUUID, callback) {
    if (options.localDBAccess === false) return callback(null);

    this.db.serialize(function() {
      this.db.get("SELECT hash FROM device_hash WHERE uuid = ?", deviceUUID, callback);
    }.bind(this));
  },

  storeSecret: function(deviceUUID, hash, callback) {
    if (options.localDBAccess === false) return callback(null);

    this.db.serialize(function() {
      this.db.run("INSERT OR REPLACE INTO device_hash(uuid, hash) VALUES (?, ?)",
      deviceUUID, hash, callback);
    }.bind(this));
  },

  setModuleInfo: function(name, version, callback) {
    if (options.localDBAccess === false) return callback(null);

    if (name == null) {
      return callback(new Error('setting incorrect module name'), null);
    }

    this.moduleDB.serialize(function() {
      this.moduleDB.run("INSERT OR REPLACE INTO module_info(name, version) VALUES (?, ?)",
      name, version, callback);
    }.bind(this));
  },

  removeModuleInfo: function(name, callback) {
    if (options.localDBAccess === false) return callback(null);

    if (name == null) {
      return callback(new Error('remove incorrect module name'), null);
    }

    this.moduleDB.serialize(function() {
      this.moduleDB.run("DELETE FROM module_info WHERE name = ?", name, callback);
    }.bind(this));
  },

  getAllModuleInfo: function(callback) {
    if (options.localDBAccess === false) return callback(null);

    this.moduleDB.parallelize(function() {
      this.moduleDB.all("SELECT * FROM module_info", callback);
    }.bind(this));
  },

  init: function() {
    var deviceDBName, moduleDBName;

    if (options.localDBAccess === false) {
      return logger.info('loading local module, device DB access is disabled');
    }

    if (options.dbPath !== null) {
      deviceDBName = options.dbPath + '/device_store.db';
      moduleDBName = options.dbPath + '/modules.db';
      //TODO: check write safety of this call, do not crash
      try {
        mkdirp.sync(options.dbPath);
        fs.accessSync(options.dbPath, fs.W_OK);
      } catch (e) {
        return logger.error('cannot access DB folder: ' + options.dbPath + ' reason: ' + e.message);
        process.exit(-1);
      }
    } else {
      // assume local install folder is always writable
      deviceDBName = __dirname + '/../device_store.db';
      moduleDBName = __dirname + '/../modules.db';
    }

    this.db       = new sqlite3.Database(deviceDBName);
    this.moduleDB = new sqlite3.Database(moduleDBName);

    this.db.serialize(function() {
      this.db.run("CREATE TABLE IF NOT EXISTS device_db(hwaddr TEXT PRIMARY KEY, uuid TEXT, spec TEXT)");
      this.db.run("CREATE TABLE IF NOT EXISTS device_hash(uuid TEXT PRIMARY KEY, hash TEXT)");
    }.bind(this));

    this.moduleDB.serialize(function() {
      this.moduleDB.run("CREATE TABLE IF NOT EXISTS module_info(name TEXT PRIMARY KEY, version TEXT)");
    }.bind(this));
  }
};

