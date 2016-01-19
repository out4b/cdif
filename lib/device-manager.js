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
          console.error(err);
          return;
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

        if (!_this.deviceMap[deviceUUID]) {
          _this.deviceMap[deviceUUID] = cdifDevice;
        }
        cdifDevice.on('authorizeredirect', _this.onOAuthAuthorizeRedirect.bind(_this));
      });
    } else {
      console.error('cannot get HW address for device: ' + cdifDevice.spec.device.friendlyName);
    }
  });
};

DeviceManager.prototype.onDeviceOffline = function(cdifDevice) {
  console.log('deviceoffline');
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
    if (cdifDevice.spec) {
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
    callback(new CdifError('device not found'));
    return;
  }
  if (cdifDevice.module.discoverState === 'discovering') {
    callback(new CdifError('in discovering'));
    return;
  }
  if (cdifDevice.connected === false) {
    callback(new CdifError('device not connected'));
    return;
  }
  if (cdifDevice.spec.device.userAuth === true) {
    this.deviceAuth.verifyAccess(cdifDevice.secret, token, callback);
  } else {
    callback(null);
  }
};

DeviceManager.prototype.connectDevice = function(deviceID, user, pass, callback) {
  this.emit('connect', deviceID, user, pass, callback);
};

DeviceManager.prototype.onConnectDevice = function(deviceID, user, pass, callback) {
  var _this = this;
  var cdifDevice = this.deviceMap[deviceID];
  if (!cdifDevice) {
    callback(new CdifError('device not found'), null);
    return;
  }
  if (cdifDevice.module.discoverState === 'discovering') {
    callback(new CdifError('in discovering', null));
    return;
  }

  cdifDevice.connect(user, pass, function(err, secret) {
    if (err) {
      callback(err, null);
    } else {
      if (secret) {
        var token = _this.deviceAuth.generateToken(user, secret, function(err, data) {
          if (err) {
            callback(new CdifError('cannot generate access token'), null);
          } else {
            callback(null, {'device_access_token': data});
          }
        });
      } else {
        callback(null, null);
      }
      if (cdifDevice.spec.device.devicePresentation === true) {
        if (cdifDevice.connections === 1)
          _this.emit('presentation', cdifDevice.deviceID);
      }
    }
  });
};

DeviceManager.prototype.disconnectDevice = function(deviceID, token, callback) {
  this.emit('disconnect', deviceID, token, callback);
};

DeviceManager.prototype.onDisconnectDevice = function(deviceID, token, callback) {
  var cdifDevice = this.deviceMap[deviceID];

  this.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      callback(err);
    } else {
      cdifDevice.disconnect(callback);
    }
  });
};

DeviceManager.prototype.invokeDeviceAction = function(deviceID, serviceID, actionName, args, token, callback) {
  this.emit('invokeaction', deviceID, serviceID, actionName, args, token, callback);
};

DeviceManager.prototype.onInvokeDeviceAction = function(deviceID, serviceID, actionName, args, token, callback) {
  var cdifDevice = this.deviceMap[deviceID];

  this.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      callback(err);
    } else {
      try {
        cdifDevice.deviceControl(serviceID, actionName, args, callback);
      } catch (e) {
        callback(new DeviceError(e.message), null); //framework won't throw
      }
    }
  });
};

DeviceManager.prototype.getDeviceSpec = function(deviceID, token, callback) {
  this.emit('getspec', deviceID, token, callback);
};

DeviceManager.prototype.onGetDeviceSpec = function(deviceID, token, callback) {
  var cdifDevice = this.deviceMap[deviceID];

  this.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      callback(err);
    } else {
      cdifDevice.getDeviceSpec(callback);
    }
  });
};

DeviceManager.prototype.getDeviceState = function(deviceID, serviceID, token, callback) {
  this.emit('devicestate', deviceID, serviceID, token, callback);
};

DeviceManager.prototype.onGetDeviceState = function(deviceID, serviceID, token, callback) {
  var cdifDevice = this.deviceMap[deviceID];

  this.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      callback(err);
    } else {
      cdifDevice.getServiceStates(serviceID, callback);
    }
  });
};

DeviceManager.prototype.eventSubscribe = function(subscriber, deviceID, serviceID, token, callback) {
  this.emit('subscribe', subscriber, deviceID, serviceID, token, callback);
};

DeviceManager.prototype.onEventSubscribe = function(subscriber, deviceID, serviceID, token, callback) {
  var cdifDevice = this.deviceMap[deviceID];

  this.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      callback(err);
    } else {
      cdifDevice.subscribeDeviceEvent(subscriber, serviceID, callback);
    }
  });
};

DeviceManager.prototype.eventUnsubscribe = function(subscriber, deviceID, serviceID, token, callback) {
  this.emit('unsubscribe', subscriber, deviceID, serviceID, token, callback);
};

DeviceManager.prototype.onEventUnsubscribe = function(subscriber, deviceID, serviceID, token, callback) {
  var cdifDevice = this.deviceMap[deviceID];

  this.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      callback(err);
    } else {
      cdifDevice.unSubscribeDeviceEvent(subscriber, serviceID, callback);
    }
  });
};

DeviceManager.prototype.getDeviceSchema = function(deviceID, path, token, callback) {
  this.emit('getschema', deviceID, path, token, callback);
};

DeviceManager.prototype.onGetDeviceSchema = function(deviceID, path, token, callback) {
  var cdifDevice = this.deviceMap[deviceID];

  this.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      callback(err);
    } else {
      cdifDevice.resolveSchemaFromPath(path, null, function(error, self, data) {
        if (!error) {
          callback(null, data);
        } else {
          callback(error, null);
        }
      });
    }
  });
};

DeviceManager.prototype.setDeviceOAuthAccessToken = function(deviceID, params, callback) {
  this.emit('setoauthtoken', deviceID, params, callback);
};

DeviceManager.prototype.onSetDeviceOAuthAccessToken = function(deviceID, params, callback) {
  var cdifDevice = this.deviceMap[deviceID];

  if (cdifDevice == null) {  // check null or undefined
    callback(new CdifError('device not found'));
    return;
  }
  cdifDevice.setOAuthAccessToken(params, callback);
};

DeviceManager.prototype.getDeviceRootUrl = function(deviceID, callback) {
  this.emit('getrooturl', deviceID, callback);
};

DeviceManager.prototype.onGetDeviceRootUrl = function(deviceID, callback) {
  var cdifDevice = this.deviceMap[deviceID];

  if (!cdifDevice) {
    callback(new CdifError('device not found'));
  } else {
    cdifDevice.getDeviceRootUrl(callback);
  }
};

DeviceManager.prototype.onOAuthAuthorizeRedirect = function(authorize_redirect_url, deviceID) {
  this.emit('authorizeredirect', authorize_redirect_url, deviceID);
};

module.exports = DeviceManager;
