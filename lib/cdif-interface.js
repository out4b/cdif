var CdifError   = require('./error').CdifError;
var DeviceError = require('./error').DeviceError;

function CdifInterface(deviceManager) {
  this.deviceManager = deviceManager;
}

CdifInterface.prototype.discoverAll = function(callback) {
  this.deviceManager.emit('discoverall', callback);
};

CdifInterface.prototype.stopDiscoverAll = function(callback) {
  this.deviceManager.emit('stopdiscoverall', callback);
};

CdifInterface.prototype.getDiscoveredDeviceList = function(callback) {
  this.deviceManager.emit('devicelist', callback);
};

CdifInterface.prototype.connectDevice = function(deviceID, user, pass, callback) {
  var _this = this;
  var cdifDevice = this.deviceManager.deviceMap[deviceID];
  if (cdifDevice == null) {
    return callback(new CdifError('device not found'), null);
  }
  if (cdifDevice.online !== true) {
    return callback(new CdifError('device offlined'), null);
  }
  if (cdifDevice.module.discoverState === 'discovering') {
    return callback(new CdifError('in discovering', null));
  }

  if (cdifDevice.listeners('onconnect').length === 0) {
    cdifDevice.setDeviceTimeout(function() {
      cdifDevice.online = false;
      cdifDevice.removeAllListeners('onconnect');
      callback(new DeviceError('device not responding'), null);
    });

    cdifDevice.once('onconnect', callback);
    this.deviceManager.emit('connect', cdifDevice, user, pass);
  } else {
    callback(new CdifError('device in connecting'), null);
  }
};

CdifInterface.prototype.disconnectDevice = function(deviceID, token, callback) {
  var cdifDevice = this.deviceManager.deviceMap[deviceID];

  this.deviceManager.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      return callback(err);
    }
    if (cdifDevice.listeners('ondisconnect').length === 0) {
      cdifDevice.setDeviceTimeout(function() {
        cdifDevice.online = false;
        cdifDevice.removeAllListeners('ondisconnect');
        callback(new DeviceError('device not responding'), null);
      });

      cdifDevice.once('ondisconnect', callback);
      this.deviceManager.emit('disconnect', cdifDevice);
    } else {
      callback(new CdifError('device in disconnecting'), null);
    }
  }.bind(this));
};

CdifInterface.prototype.invokeDeviceAction = function(deviceID, serviceID, actionName, args, token, callback) {
  var cdifDevice = this.deviceManager.deviceMap[deviceID];

  this.deviceManager.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      return callback(err);
    }
    if (cdifDevice.listeners('oninvokeaction').length === 0) {
      cdifDevice.setDeviceTimeout(function() {
        cdifDevice.online = false;
        cdifDevice.removeAllListeners('oninvokeaction');
        callback(new DeviceError('device not responding'), null);
      });

      cdifDevice.once('oninvokeaction', callback);
      this.deviceManager.emit('invokeaction', cdifDevice, serviceID, actionName, args);
    } else {
      callback(new CdifError('device in action'), null);
    }
  }.bind(this));
};

CdifInterface.prototype.getDeviceSpec = function(deviceID, token, callback) {
  var cdifDevice = this.deviceManager.deviceMap[deviceID];

  this.deviceManager.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      return callback(err);
    }
    if (cdifDevice.listeners('ongetspec').length === 0) {
      cdifDevice.setDeviceTimeout(function() {
        cdifDevice.online = false;
        cdifDevice.removeAllListeners('ongetspec');
        callback(new DeviceError('device not responding'), null);
      });

      cdifDevice.once('ongetspec', callback);
      this.deviceManager.emit('getspec', cdifDevice);
    } else {
      callback(new CdifError('device in getspec'), null);
    }
  }.bind(this));
};

CdifInterface.prototype.getDeviceState = function(deviceID, serviceID, token, callback) {
  var cdifDevice = this.deviceManager.deviceMap[deviceID];

  this.deviceManager.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      return callback(err);
    }
    if (cdifDevice.listeners('ongetstate').length === 0) {
      cdifDevice.setDeviceTimeout(function() {
        cdifDevice.online = false;
        cdifDevice.removeAllListeners('ongetstate');
        callback(new DeviceError('device not responding'), null);
      });

      cdifDevice.once('ongetstate', callback);
      this.deviceManager.emit('getstate', cdifDevice, serviceID);
    } else {
      callback(new CdifError('device in getstate'), null);
    }
  }.bind(this));
};

CdifInterface.prototype.eventSubscribe = function(subscriber, deviceID, serviceID, token, callback) {
  var cdifDevice = this.deviceManager.deviceMap[deviceID];

  this.deviceManager.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      return callback(err);
    }
    if (cdifDevice.listeners('onsubscribe').length === 0) {
      cdifDevice.setDeviceTimeout(function() {
        cdifDevice.online = false;
        cdifDevice.removeAllListeners('onsubscribe');
        callback(new DeviceError('device not responding'), null);
      });

      cdifDevice.once('onsubscribe', callback);
      this.deviceManager.emit('subscribe', subscriber, cdifDevice, serviceID);
    } else {
      callback(new CdifError('device in subscribing'), null);
    }
  }.bind(this));
};

CdifInterface.prototype.eventUnsubscribe = function(subscriber, deviceID, serviceID, token, callback) {
  var cdifDevice = this.deviceManager.dedeviceMap[deviceID];

  this.deviceManager.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      return callback(err);
    }
    if (cdifDevice.listeners('onunsubscribe').length === 0) {
      cdifDevice.setDeviceTimeout(function() {
        cdifDevice.online = false;
        cdifDevice.removeAllListeners('onunsubscribe');
        callback(new DeviceError('device not responding'), null);
      });

      cdifDevice.once('onunsubscribe', callback);
      this.deviceManager.emit('unsubscribe', subscriber, cdifDevice, serviceID);
    } else {
      callback(new CdifError('device in unsubscribing'), null);
    }
  }.bind(this));
};

// let callback passed to dm
CdifInterface.prototype.getDeviceSchema = function(deviceID, path, token, callback) {
  var cdifDevice = this.deviceManager.deviceMap[deviceID];

  this.deviceManager.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      return callback(err);
    }
    this.deviceManager.emit('getschema', cdifDevice, path, callback);
  }.bind(this));
};

CdifInterface.prototype.setDeviceOAuthAccessToken = function(deviceID, params, callback) {
  var cdifDevice = this.deviceManager.deviceMap[deviceID];

  if (cdifDevice == null) {  // check null or undefined
    return callback(new CdifError('device not found'));
  }
  if (cdifDevice.listeners('onsetoauthtoken').length === 0) {
    cdifDevice.setDeviceTimeout(function() {
      cdifDevice.online = false;
      cdifDevice.removeAllListeners('onsetoauthtoken');
      callback(new DeviceError('device not responding'), null);
    });

    cdifDevice.once('onsetoauthtoken', callback);
    this.deviceManager.emit('setoauthtoken', cdifDevice, params);
  } else {
    callback(new CdifError('device in set oauth token'), null);
  }
};

// let callback passed to dm
CdifInterface.prototype.getDeviceRootUrl = function(deviceID, callback) {
  var cdifDevice = this.deviceManager.deviceMap[deviceID];

  if (cdifDevice == null) {
    return callback(new CdifError('device not found'));
  }
  this.deviceManager.emit('getrooturl', cdifDevice, callback);
};

module.exports = CdifInterface;
