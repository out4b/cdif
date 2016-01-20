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

  cdifDevice.setDeviceTimeout(function() {
    cdifDevice.online = false;
    callback(new DeviceError('device not responding'), null);
  });
  this.emit('connect', cdifDevice, user, pass, callback);
};

DeviceManager.prototype.onConnectDevice = function(cdifDevice, user, pass, callback) {
  var _this = this;

  cdifDevice.connect(user, pass, function(err, secret) {
    if (cdifDevice.online === false) return;
    cdifDevice.clearDeviceTimeout();

    if (err) {
      return callback(err, null);
    }
    if (secret) {
      var token = _this.deviceAuth.generateToken(user, secret, function(err, data) {
        if (err) {
          return callback(new CdifError('cannot generate access token'), null);
        }
        callback(null, {'device_access_token': data});
      });
    } else {
      callback(null, null);
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
    cdifDevice.setDeviceTimeout(function() {
      cdifDevice.online = false;
      callback(new DeviceError('device not responding'), null);
    });
    this.emit('disconnect', cdifDevice, callback);
  }.bind(this));
};

DeviceManager.prototype.onDisconnectDevice = function(cdifDevice, callback) {
  cdifDevice.disconnect(function(err) {
    if (cdifDevice.online === false) return;
    cdifDevice.clearDeviceTimeout();
    callback(err);
  });
};

DeviceManager.prototype.invokeDeviceAction = function(deviceID, serviceID, actionName, args, token, callback) {
  var cdifDevice = this.deviceMap[deviceID];

  this.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      return callback(err);
    }
    cdifDevice.setDeviceTimeout(function() {
      cdifDevice.online = false;
      callback(new DeviceError('device not responding'), null);
    });
    this.emit('invokeaction', cdifDevice, serviceID, actionName, args, callback);
  }.bind(this));
};

DeviceManager.prototype.onInvokeDeviceAction = function(cdifDevice, serviceID, actionName, args, callback) {
  try {
    cdifDevice.deviceControl(serviceID, actionName, args, function(err, data) {
      if (cdifDevice.online === false) return;
      cdifDevice.clearDeviceTimeout();
      callback(err, data);
    });
  } catch (e) {
    if (cdifDevice.online === false) return;
    cdifDevice.clearDeviceTimeout();
    return callback(new DeviceError(e.message), null); //framework won't throw
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
    cdifDevice.setDeviceTimeout(function() {
      cdifDevice.online = false;
      callback(new DeviceError('device not responding'), null);
    });
    this.emit('subscribe', subscriber, cdifDevice, serviceID, callback);
  }.bind(this));
};

DeviceManager.prototype.onEventSubscribe = function(subscriber, cdifDevice, serviceID, callback) {
  cdifDevice.subscribeDeviceEvent(subscriber, serviceID, function(err) {
    if (cdifDevice.online === false) return;
    cdifDevice.clearDeviceTimeout();
    callback(err);
  });
};

DeviceManager.prototype.eventUnsubscribe = function(subscriber, deviceID, serviceID, token, callback) {
  var cdifDevice = this.deviceMap[deviceID];

  this.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      return callback(err);
    }
    cdifDevice.setDeviceTimeout(function() {
      cdifDevice.online = false;
      callback(new DeviceError('device not responding'), null);
    });
    this.emit('unsubscribe', subscriber, cdifDevice, serviceID, callback);
  }.bind(this));
};

DeviceManager.prototype.onEventUnsubscribe = function(subscriber, cdifDevice, serviceID, callback) {
  cdifDevice.unSubscribeDeviceEvent(subscriber, serviceID, function(err) {
    if (cdifDevice.online === false) return;
    cdifDevice.clearDeviceTimeout();
    callback(err);
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

  cdifDevice.setDeviceTimeout(function() {
    cdifDevice.online = false;
    callback(new DeviceError('device not responding'), null);
  });
  this.emit('setoauthtoken', cdifDevice, params, callback);
};

DeviceManager.prototype.onSetDeviceOAuthAccessToken = function(cdifDevice, params, callback) {
  cdifDevice.setOAuthAccessToken(params, function(err) {
    if (cdifDevice.online === false) return;
    cdifDevice.clearDeviceTimeout();
    callback(err);
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
