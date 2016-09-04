var events      = require('events');
var util        = require('util');
var uuid        = require('uuid');
var DeviceDB    = require('./device-db');
var DeviceAuth  = require('./device-auth');
var validator   = require('./validator');
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
  this.on('devicelist',      this.onGetDiscoveredDeviceList.bind(this));
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
  var _this = this;

  validator.validateDeviceSpec(cdifDevice.spec, function(error) {
    if (error) {
      return console.error(error.message + ',  device spec: ' + JSON.stringify(cdifDevice.spec));
    }

    cdifDevice.getHWAddress(function(err, addr) {
      var hwAddr;
      var deviceUUID;
      if (!err) {
        hwAddr = addr;
        _this.deviceDB.getDeviceUUIDFromHWAddr(hwAddr, function(err, data) {
          if (err) {
            return console.error(err);
          }
          if (!data) {
            deviceUUID = uuid.v4();
            _this.deviceDB.setDeviceUUID(hwAddr, deviceUUID, function(err) {
              if (err) {
                console.error('cannot insert address record for device:' + deviceUUID);
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
        });
      } else {
        console.error('cannot get HW address for device: ' + cdifDevice.spec.device.friendlyName);
      }
    });
  });
};

// for now this is not triggered
DeviceManager.prototype.onDeviceOffline = function(cdifDevice, m) {
  console.error('device not responding: ' + cdifDevice.deviceID);
  cdifDevice.online = false;
};

DeviceManager.prototype.onDiscoverAll = function(callback) {
  this.moduleManager.discoverAllDevices();
  callback(null);
};

DeviceManager.prototype.onStopDiscoverAll = function(callback) {
  this.moduleManager.stopDiscoverAllDevices();
  callback(null);
};

DeviceManager.prototype.onGetDiscoveredDeviceList = function(callback) {
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
  if (cdifDevice.connectionState !== 'connected') {
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

DeviceManager.prototype.onConnectDevice = function(cdifDevice, user, pass) {
  var _this = this;

  try {
    cdifDevice.connect(user, pass, function(err, secret, redirectObj) {
      if (cdifDevice.online === false) return;
      cdifDevice.clearDeviceTimeout('onconnect');

      if (err) {
        return cdifDevice.emit('onconnect', err, null);
      }

      if (secret) {
        // FIXME: this brings in 'user' from context which could be an issue
        _this.deviceAuth.generateToken(user, secret, function(err, token) {
          if (err) {
            return cdifDevice.emit('onconnect', new CdifError('cannot generate access token'), null);
          }
          if (redirectObj) {
            cdifDevice.emit('onconnect', null, {'device_access_token': token, 'url_redirect': redirectObj});
          } else {
            cdifDevice.emit('onconnect', null, {'device_access_token': token});
          }
        });
      } else {
        if (redirectObj != null) {
          cdifDevice.emit('onconnect', null, {'url_redirect': redirectObj});
        } else {
          cdifDevice.emit('onconnect', null, null);
        }
      }
      //FIXME: do not emit presentation event more than once
      if (cdifDevice.spec.device.devicePresentation === true) {
        _this.emit('presentation', cdifDevice.deviceID);
      }
    });
  } catch (e) {
    if (cdifDevice.online === false) return;
    cdifDevice.clearDeviceTimeout('onconnect');

    return cdifDevice.emit('onconnect', new DeviceError(e.message), null);
  }
};

DeviceManager.prototype.onDisconnectDevice = function(cdifDevice) {
  try {
    cdifDevice.disconnect(function(err) {
      if (cdifDevice.online === false) return;
      cdifDevice.clearDeviceTimeout('ondisconnect');
      cdifDevice.emit('ondisconnect', err);
    });
  } catch (e) {
      if (cdifDevice.online === false) return;
      cdifDevice.clearDeviceTimeout('ondisconnect');
      return cdifDevice.emit('ondisconnect', new DeviceError(e.message), null);
  }
};

DeviceManager.prototype.onInvokeDeviceAction = function(cdifDevice, serviceID, actionName, args) {
  try {
    cdifDevice.deviceControl(serviceID, actionName, args, function(err, data) {
      if (cdifDevice.online === false) return;
      cdifDevice.clearDeviceTimeout('oninvokeaction');
      cdifDevice.emit('oninvokeaction', err, data);
    });
  } catch (e) {
    if (cdifDevice.online === false) return;
    cdifDevice.clearDeviceTimeout('oninvokeaction');
    return cdifDevice.emit('oninvokeaction', new DeviceError(e.message), null); //framework won't throw
  }
};

DeviceManager.prototype.onGetDeviceSpec = function(cdifDevice) {
  cdifDevice.getDeviceSpec(function(err, data) {
    if (cdifDevice.online === false) return;
    cdifDevice.clearDeviceTimeout('ongetspec');
    cdifDevice.emit('ongetspec', err, data);
  });
};

DeviceManager.prototype.onGetDeviceState = function(cdifDevice, serviceID) {
  cdifDevice.getServiceStates(serviceID, function(err, data) {
    if (cdifDevice.online === false) return;
    cdifDevice.clearDeviceTimeout('ongetstate');
    cdifDevice.emit('ongetstate', err, data);
  });
};

DeviceManager.prototype.onEventSubscribe = function(subscriber, cdifDevice, serviceID) {
  cdifDevice.subscribeDeviceEvent(subscriber, serviceID, function(err) {
    if (cdifDevice.online === false) return;
    cdifDevice.clearDeviceTimeout('onsubscribe');
    cdifDevice.emit('onsubscribe', err);
  });
};

DeviceManager.prototype.onEventUnsubscribe = function(subscriber, cdifDevice, serviceID) {
  cdifDevice.unSubscribeDeviceEvent(subscriber, serviceID, function(err) {
    if (cdifDevice.online === false) return;
    cdifDevice.clearDeviceTimeout('onunsubscribe');
    cdifDevice.emit('onunsubscribe', err);
  });
};

DeviceManager.prototype.onGetDeviceSchema = function(cdifDevice, path, callback) {
  cdifDevice.resolveSchemaFromPath(path, null, function(error, self, data) {
    if (error) {
      return callback(error, null);
    }
    callback(null, data);
  });
};

DeviceManager.prototype.onSetDeviceOAuthAccessToken = function(cdifDevice, params) {
  cdifDevice.setOAuthAccessToken(params, function(err) {
    if (cdifDevice.online === false) return;
    cdifDevice.clearDeviceTimeout('onsetoauthtoken');
    cdifDevice.emit('onsetoauthtoken', err);
  });
};

DeviceManager.prototype.onGetDeviceRootUrl = function(cdifDevice, callback) {
  cdifDevice.getDeviceRootUrl(function(err, data) {
    callback(err, data);
  });
};

module.exports = DeviceManager;
