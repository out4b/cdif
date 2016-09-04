var sqlite3 = require('sqlite3');

var db = null;

function DeviceDB() {
  db = new sqlite3.Database('./device_addr.db');
  //TODO: close db on framework exit
  db.serialize(function() {
    db.run("CREATE TABLE IF NOT EXISTS device_addr(hwaddr TEXT PRIMARY KEY, uuid TEXT)");
  });
}

DeviceDB.prototype.getDeviceUUIDFromHWAddr = function(hwAddr, callback) {
  db.serialize(function() {
    db.get("SELECT uuid FROM device_addr WHERE hwaddr = ?", hwAddr, callback);
  });
}

DeviceDB.prototype.insertRecord = function(hwAddr, deviceUUID) {
  db.serialize(function() {
    db.run("INSERT INTO device_addr(hwaddr, uuid) VALUES (?, ?)", hwAddr, deviceUUID);
  });
}

module.exports = DeviceDB;
