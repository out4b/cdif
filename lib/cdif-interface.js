var events      = require('events');
var util        = require('util');

var DeviceManager = require('./device-manager');
var CdifError     = require('./error').CdifError;
var DeviceError   = require('./error').DeviceError;

function CdifInterface(mm) {
  this.deviceManager = new DeviceManager(mm);

  this.deviceManager.on('presentation',      this.onDevicePresentation.bind(this));
  this.deviceManager.on('authorizeredirect', this.onAuthorizeRedirect.bind(this));
}

util.inherits(CdifInterface, events.EventEmitter);

CdifInterface.prototype.discoverAll = function(callback) {
  this.deviceManager.emit('discoverall', callback);
};

CdifInterface.prototype.stopDiscoverAll = function(callback) {
  this.deviceManager.emit('stopdiscoverall', callback);
};

CdifInterface.prototype.getDiscoveredDeviceList = function(callback) {
  this.deviceManager.emit('devicelist', callback);
};

CdifInterface.prototype.connectDevice = function(deviceID, user, pass, callback, redirect) {
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

  cdifDevice.once('authredirect', redirect);

  if (cdifDevice.installTimeoutHandlers('onconnect', callback)) {
    this.deviceManager.emit('connect', cdifDevice, user, pass);
  }
};

CdifInterface.prototype.disconnectDevice = function(deviceID, token, callback) {
  var cdifDevice = this.deviceManager.deviceMap[deviceID];

  this.deviceManager.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      return callback(err);
    }
    if (cdifDevice.installTimeoutHandlers('ondisconnect', callback)) {
      this.deviceManager.emit('disconnect', cdifDevice);
    }
  }.bind(this));
};

CdifInterface.prototype.invokeDeviceAction = function(deviceID, serviceID, actionName, args, token, callback) {
  var cdifDevice = this.deviceManager.deviceMap[deviceID];

  this.deviceManager.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      return callback(err);
    }
    if (cdifDevice.installTimeoutHandlers('oninvokeaction', callback)) {
      this.deviceManager.emit('invokeaction', cdifDevice, serviceID, actionName, args);
    }
  }.bind(this));
};

CdifInterface.prototype.getDeviceSpec = function(deviceID, token, callback) {
  var cdifDevice = this.deviceManager.deviceMap[deviceID];

  this.deviceManager.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      return callback(err);
    }
    if (cdifDevice.installTimeoutHandlers('ongetspec', callback)) {
      this.deviceManager.emit('getspec', cdifDevice);
    }
  }.bind(this));
};

CdifInterface.prototype.getDeviceState = function(deviceID, serviceID, token, callback) {
  var cdifDevice = this.deviceManager.deviceMap[deviceID];

  this.deviceManager.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      return callback(err);
    }
    if (cdifDevice.installTimeoutHandlers('ongetstate', callback)) {
      this.deviceManager.emit('getstate', cdifDevice, serviceID);
    }
  }.bind(this));
};

CdifInterface.prototype.eventSubscribe = function(subscriber, deviceID, serviceID, token, callback) {
  var cdifDevice = this.deviceManager.deviceMap[deviceID];

  this.deviceManager.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      return callback(err);
    }
    if (cdifDevice.installTimeoutHandlers('onsubscribe', callback)) {
      this.deviceManager.emit('subscribe', subscriber, cdifDevice, serviceID);
    }
  }.bind(this));
};

CdifInterface.prototype.eventUnsubscribe = function(subscriber, deviceID, serviceID, token, callback) {
  var cdifDevice = this.deviceManager.dedeviceMap[deviceID];

  this.deviceManager.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      return callback(err);
    }
    if (cdifDevice.installTimeoutHandlers('onunsubscribe', callback)) {
      this.deviceManager.emit('unsubscribe', subscriber, cdifDevice, serviceID);
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
  if (cdifDevice.installTimeoutHandlers('onsetoauthtoken', callback)) {
    this.deviceManager.emit('setoauthtoken', cdifDevice, params);
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

CdifInterface.prototype.onAuthorizeRedirect = function(authorize_redirect_url, deviceID) {
  var cdifDevice = this.deviceManager.deviceMap[deviceID];

  cdifDevice.emit('authredirect', authorize_redirect_url);
};

CdifInterface.prototype.onDevicePresentation = function(deviceID) {
  this.emit('presentation', deviceID);
};

module.exports = CdifInterface;
