var events      = require('events');
var util        = require('util');
var uuid        = require('uuid');
var DeviceDB    = require('./device-db');
var DeviceAuth  = require('./device-auth');
var CdifError   = require('./error').CdifError;
var DeviceError = require('./error').DeviceError;

function DeviceManager(mm) {
  this.deviceMap     = {};
  this.deviceDB      = new DeviceDB();
  this.deviceAuth    = new DeviceAuth(this.deviceDB);
  this.moduleManager = mm;

  this.moduleManager.on('deviceonline',  this.onDeviceOnline.bind(this));
  this.moduleManager.on('deviceoffline', this.onDeviceOffline.bind(this));

  this.on('discoverall',     this.onDiscoverAll.bind(this));
  this.on('stopdiscoverall', this.onStopDiscoverAll.bind(this));
  this.on('devicelist',      this.OnGetDiscoveredDeviceList.bind(this));
  this.on('connect',         this.onConnectDevice.bind(this));
  this.on('disconnect',      this.onDisconnectDevice.bind(this));
  this.on('invokeaction',    this.onInvokeDeviceAction.bind(this));
  this.on('getspec',         this.onGetDeviceSpec.bind(this));
  this.on('devicestate',     this.onGetDeviceState.bind(this));
  this.on('subscribe',       this.onEventSubscribe.bind(this));
  this.on('unsubscribe',     this.onEventUnsubscribe.bind(this));
  this.on('getschema',       this.onGetDeviceSchema.bind(this));
  this.on('setoauthtoken',   this.onSetDeviceOAuthAccessToken.bind(this));
  this.on('getrooturl',      this.onGetDeviceRootUrl.bind(this));
}

util.inherits(DeviceManager, events.EventEmitter);

DeviceManager.prototype.onDeviceOnline = function(cdifDevice, m) {
  //TODO: validate device spec schema
  var _this = this;

  cdifDevice.getHWAddress(function(err, addr) {
    var hwAddr;
    var deviceUUID;
    if(!err) {
      hwAddr = addr;
      _this.deviceDB.getDeviceUUIDFromHWAddr(hwAddr, function(err, data) {
        if (err) {
          return console.error(err);
        }
        if (!data) {
          deviceUUID = uuid.v4();
          _this.deviceDB.setDeviceUUID(hwAddr, deviceUUID, function(err) {
            if (err) {
              console.error('cannot insert address record');
            }
          });
        } else {
          deviceUUID = data.uuid;
        }
        _this.deviceDB.setSpecForDevice(hwAddr, JSON.stringify(cdifDevice.spec));
        // TODO: handle device offline and purge dead devices
        cdifDevice.module   = m;
        cdifDevice.auth     = _this.deviceAuth;
        cdifDevice.hwAddr   = hwAddr;
        cdifDevice.deviceID = deviceUUID;
        cdifDevice.online   = true;

        if (!_this.deviceMap[deviceUUID]) {
          _this.deviceMap[deviceUUID] = cdifDevice;
        } else {
          _this.deviceMap[deviceUUID].online = true;
        }
        cdifDevice.on('authorizeredirect', _this.onOAuthAuthorizeRedirect.bind(_this));
      });
    } else {
      console.error('cannot get HW address for device: ' + cdifDevice.spec.device.friendlyName);
    }
  });
};

// for now this is not triggered
DeviceManager.prototype.onDeviceOffline = function(cdifDevice, m) {
  console.error('device not responding: ' + cdifDevice.deviceID);
  cdifDevice.online = false;
};

DeviceManager.prototype.discoverAll = function(callback) {
  this.emit('discoverall', callback);
};

DeviceManager.prototype.onDiscoverAll = function(callback) {
  this.moduleManager.discoverAllDevices();
  callback(null);
};

DeviceManager.prototype.stopDiscoverAll = function(callback) {
  this.emit('stopdiscoverall', callback);
};

DeviceManager.prototype.onStopDiscoverAll = function(callback) {
  this.moduleManager.stopDiscoverAllDevices();
  callback(null);
};

DeviceManager.prototype.getDiscoveredDeviceList = function(callback) {
  this.emit('devicelist', callback);
};

DeviceManager.prototype.OnGetDiscoveredDeviceList = function(callback) {
  var deviceList = {};
  for (var i in this.deviceMap) {
    var cdifDevice = this.deviceMap[i];
    if (cdifDevice.spec && cdifDevice.online === true) {
      //this is ugly but the easiest way to handle this request
      var desc = JSON.parse(JSON.stringify(cdifDevice.spec));
      desc.device.serviceList = {};
      deviceList[i] = desc;
    }
  }
  callback(null, deviceList);
};

DeviceManager.prototype.ensureDeviceState = function(deviceID, token, callback) {
  var cdifDevice = this.deviceMap[deviceID];

  if (cdifDevice == null) {  // check null or undefined
    return callback(new CdifError('device not found'));
  }
  if (cdifDevice.module.discoverState === 'discovering') {
    return callback(new CdifError('in discovering'));
  }
  if (cdifDevice.connected === false) {
    return callback(new CdifError('device not connected'));
  }
  if (cdifDevice.online === false) {
    return callback(new CdifError('device offlined'));
  }
  if (cdifDevice.spec.device.userAuth === true) {
    this.deviceAuth.verifyAccess(cdifDevice.secret, token, callback);
  } else {
    callback(null);
  }
};

DeviceManager.prototype.connectDevice = function(deviceID, user, pass, callback) {
  var _this = this;
  var cdifDevice = this.deviceMap[deviceID];
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
    this.emit('connect', cdifDevice, user, pass);
  } else {
    callback(new CdifError('device in connecting'), null);
  }
};

DeviceManager.prototype.onConnectDevice = function(cdifDevice, user, pass) {
  var _this = this;

  cdifDevice.connect(user, pass, function(err, secret) {
    if (cdifDevice.online === false) return;
    cdifDevice.clearDeviceTimeout();

    if (err) {
      return cdifDevice.emit('onconnect', err, null);
    }
    if (secret) {
      var token = _this.deviceAuth.generateToken(user, secret, function(err, data) {
        if (err) {
          return cdifDevice.emit('onconnect', new CdifError('cannot generate access token'), null);
        }
        cdifDevice.emit('onconnect', null, {'device_access_token': data});
      });
    } else {
      cdifDevice.emit('onconnect', null, null);
    }
    if (cdifDevice.spec.device.devicePresentation === true) {
      if (cdifDevice.connections === 1)
        _this.emit('presentation', cdifDevice.deviceID);
    }
  });
};

DeviceManager.prototype.disconnectDevice = function(deviceID, token, callback) {
  var cdifDevice = this.deviceMap[deviceID];

  this.ensureDeviceState(deviceID, token, function(err) {
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
      this.emit('disconnect', cdifDevice);
    } else {
      callback(new CdifError('device in disconnecting'), null);
    }
  }.bind(this));
};

DeviceManager.prototype.onDisconnectDevice = function(cdifDevice) {
  cdifDevice.disconnect(function(err) {
    if (cdifDevice.online === false) return;
    cdifDevice.clearDeviceTimeout();
    cdifDevice.emit('ondisconnect', err);
  });
};

DeviceManager.prototype.invokeDeviceAction = function(deviceID, serviceID, actionName, args, token, callback) {
  var cdifDevice = this.deviceMap[deviceID];

  this.ensureDeviceState(deviceID, token, function(err) {
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
      this.emit('invokeaction', cdifDevice, serviceID, actionName, args);
    } else {
      callback(new CdifError('device in action'), null);
    }
  }.bind(this));
};

DeviceManager.prototype.onInvokeDeviceAction = function(cdifDevice, serviceID, actionName, args) {
  try {
    cdifDevice.deviceControl(serviceID, actionName, args, function(err, data) {
      if (cdifDevice.online === false) return;
      cdifDevice.clearDeviceTimeout();
      cdifDevice.emit('oninvokeaction', err, data);
    });
  } catch (e) {
    if (cdifDevice.online === false) return;
    cdifDevice.clearDeviceTimeout();
    return cdifDevice.emit('oninvokeaction', new DeviceError(e.message), null); //framework won't throw
  }
};

DeviceManager.prototype.getDeviceSpec = function(deviceID, token, callback) {
  var cdifDevice = this.deviceMap[deviceID];

  this.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      return callback(err);
    }
    this.emit('getspec', cdifDevice, callback);
  }.bind(this));
};

DeviceManager.prototype.onGetDeviceSpec = function(cdifDevice, callback) {
  cdifDevice.getDeviceSpec(callback);
};

DeviceManager.prototype.getDeviceState = function(deviceID, serviceID, token, callback) {
  var cdifDevice = this.deviceMap[deviceID];

  this.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      return callback(err);
    }
    this.emit('devicestate', cdifDevice, serviceID, callback);
  }.bind(this));
};

DeviceManager.prototype.onGetDeviceState = function(cdifDevice, serviceID, callback) {
  cdifDevice.getServiceStates(serviceID, callback);
};

DeviceManager.prototype.eventSubscribe = function(subscriber, deviceID, serviceID, token, callback) {
  var cdifDevice = this.deviceMap[deviceID];

  this.ensureDeviceState(deviceID, token, function(err) {
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
      this.emit('subscribe', subscriber, cdifDevice, serviceID);
    } else {
      callback(new CdifError('device in subscribing'), null);
    }
  }.bind(this));
};

DeviceManager.prototype.onEventSubscribe = function(subscriber, cdifDevice, serviceID) {
  cdifDevice.subscribeDeviceEvent(subscriber, serviceID, function(err) {
    if (cdifDevice.online === false) return;
    cdifDevice.clearDeviceTimeout();
    cdifDevice.emit('onsubscribe', err);
  });
};

DeviceManager.prototype.eventUnsubscribe = function(subscriber, deviceID, serviceID, token, callback) {
  var cdifDevice = this.deviceMap[deviceID];

  this.ensureDeviceState(deviceID, token, function(err) {
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
      this.emit('unsubscribe', subscriber, cdifDevice, serviceID);
    } else {
      callback(new CdifError('device in unsubscribing'), null);
    }
  }.bind(this));
};

DeviceManager.prototype.onEventUnsubscribe = function(subscriber, cdifDevice, serviceID) {
  cdifDevice.unSubscribeDeviceEvent(subscriber, serviceID, function(err) {
    if (cdifDevice.online === false) return;
    cdifDevice.clearDeviceTimeout();
    cdifDevice.emit('onunsubscribe', err);
  });
};

DeviceManager.prototype.getDeviceSchema = function(deviceID, path, token, callback) {
  var cdifDevice = this.deviceMap[deviceID];

  this.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      return callback(err);
    }
    this.emit('getschema', cdifDevice, path, callback);
  }.bind(this));
};

DeviceManager.prototype.onGetDeviceSchema = function(cdifDevice, path, callback) {
  cdifDevice.resolveSchemaFromPath(path, null, function(error, self, data) {
    if (error) {
      return callback(error, null);
    }
    callback(null, data);
  });
};

DeviceManager.prototype.setDeviceOAuthAccessToken = function(deviceID, params, callback) {
  var cdifDevice = this.deviceMap[deviceID];

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
    this.emit('setoauthtoken', cdifDevice, params);
  } else {
    callback(new CdifError('device in set oauth token'), null);
  }
};

DeviceManager.prototype.onSetDeviceOAuthAccessToken = function(cdifDevice, params) {
  cdifDevice.setOAuthAccessToken(params, function(err) {
    if (cdifDevice.online === false) return;
    cdifDevice.clearDeviceTimeout();
    cdifDevice.emit('onsetoauthtoken', err);
  });
};

DeviceManager.prototype.getDeviceRootUrl = function(deviceID, callback) {
  var cdifDevice = this.deviceMap[deviceID];

  if (cdifDevice == null) {
    return callback(new CdifError('device not found'));
  }

  cdifDevice.setDeviceTimeout(function() {
    cdifDevice.online = false;
    callback(new DeviceError('device not responding'));
  });
  this.emit('getrooturl', cdifDevice, callback);
};

DeviceManager.prototype.onGetDeviceRootUrl = function(cdifDevice, callback) {
  cdifDevice.getDeviceRootUrl(function(err, data) {
    if (cdifDevice.online === false) return;
    cdifDevice.clearDeviceTimeout();
    callback(err, data);
  });
};

DeviceManager.prototype.onOAuthAuthorizeRedirect = function(authorize_redirect_url, deviceID) {
  var cdifDevice = this.deviceMap[deviceID];

  if (cdifDevice.online === false) return;
  cdifDevice.clearDeviceTimeout();
  this.emit('authorizeredirect', authorize_redirect_url, deviceID);
};

module.exports = DeviceManager;
