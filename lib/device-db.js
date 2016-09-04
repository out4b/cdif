var sqlite3 = require('sqlite3');

var db = null;

function DeviceDB() {
  db = new sqlite3.Database('./device_store.db');
  //TODO: close db on framework exit
  db.serialize(function() {
    db.run("CREATE TABLE IF NOT EXISTS device_db(hwaddr TEXT PRIMARY KEY, uuid TEXT, spec TEXT)");
  });
}

DeviceDB.prototype.getDeviceUUIDFromHWAddr = function(hwAddr, callback) {
  db.serialize(function() {
    db.get("SELECT uuid FROM device_db WHERE hwaddr = ?", hwAddr, callback);
  });
};

DeviceDB.prototype.setDeviceUUID = function(hwAddr, deviceUUID, callback) {
  db.serialize(function() {
    db.run("INSERT OR REPLACE INTO device_db(hwaddr, uuid, spec) VALUES (?, ?, (SELECT spec FROM device_db WHERE hwaddr = ?))",
    hwAddr, deviceUUID, hwAddr, callback);
  });
};

DeviceDB.prototype.getDeviceSpecFromHWAddr = function(hwAddr, callback) {
  db.serialize(function() {
    db.get("SELECT spec FROM device_db WHERE hwaddr = ?", hwAddr, callback);
  });
};

DeviceDB.prototype.setSpecForDevice = function(hwAddr, spec) {
  db.serialize(function() {
    db.run("INSERT OR REPLACE INTO device_db(hwaddr, uuid, spec) VALUES (?, (SELECT uuid FROM device_db WHERE hwaddr = ?), ?)",
    hwAddr, hwAddr, spec);
  });
};

DeviceDB.prototype.getSpecForAllDevices = function(callback) {
  db.parallelize(function() {
    db.all("SELECT spec FROM device_db", callback);
  });
};

DeviceDB.prototype.deleteDeviceInformation = function(hwAddr, callback) {
  db.serialize(function() {
    db.run("DELETE FROM device_db WHERE hwaddr = ?", hwAddr, callback);
  });
};


module.exports = DeviceDB;
