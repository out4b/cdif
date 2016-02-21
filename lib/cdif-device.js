var events      = require('events');
var util        = require('util');
var url         = require('url');
var parser      = require('json-schema-ref-parser');
var CdifError   = require('./error').CdifError;
var DeviceError = require('./error').DeviceError;
var Service     = require('./service');
var Timeout     = require('./timeout');

//warn: try not add event listeners in this class
function CdifDevice(spec) {
  this.spec        = spec;
  this.deviceID    = '';
  this.user        = '';
  this.secret      = '';
  this.connected   = false;
  this.redirecting = false;
  this.timeout     = {};
  this.schemaDoc   = this.getDeviceRootSchema();

  this.initServices();

  this.getDeviceSpec          = this.getDeviceSpec.bind(this);
  this.connect                = this.connect.bind(this);
  this.disconnect             = this.disconnect.bind(this);
  this.getHWAddress           = this.getHWAddress.bind(this);
  this.deviceControl          = this.deviceControl.bind(this);
  this.subscribeDeviceEvent   = this.subscribeDeviceEvent.bind(this);
  this.unSubscribeDeviceEvent = this.unSubscribeDeviceEvent.bind(this);
}

util.inherits(CdifDevice, events.EventEmitter);


CdifDevice.prototype.setAction = function(serviceID, actionName, action) {
  if (action === null || typeof(action) !== 'function') {
    console.error('set incorrect action type for: ' + serviceID + ' ' + actionName);
    return;
  }
  var service = this.services[serviceID];
  if (service) {
    service.actions[actionName].invoke = action.bind(this);
  } else {
    console.error('cannot set action: ' + serviceID + ' ' + actionName);
  }
};

CdifDevice.prototype.initServices = function() {
  var serviceList = this.spec.device.serviceList;

  if (!this.services) {
    this.services = new Object();
  }
  for (var i in serviceList) {
    var service_spec = serviceList[i];
    if (!this.services[i]) {
      this.services[i] = new Service(this, i, service_spec);
    } else {
      this.services[i].updateSpec(service_spec);
    }
  }
};

CdifDevice.prototype.getDeviceSpec = function(callback) {
  if (this.spec === null) {
    return callback(new CdifError('cannot get device spec'), null);
  }
  console.log('device name: ' + this.spec.device.friendlyName + ' deviceID: ' + this.deviceID);
  callback(null, this.spec);
};

CdifDevice.prototype.getServiceStates = function(serviceID, callback) {
  if (callback && typeof(callback) !== 'function') {
    return console.error('not valid callback');
  }
  var service = this.services[serviceID];
  if (service == null) {
    if (callback) {
      return callback(new CdifError('service not found: ' + serviceID), null);
    }
  }
  if (this.connected === false) {
    if (callback) {
      return callback(new CdifError('device not connected'), null);
    }
  }
  service.getServiceStates(callback);
};

CdifDevice.prototype.setServiceStates = function(serviceID, values, callback) {
  if (callback && typeof(callback) !== 'function') {
    return console.error('not valid callback');
  }
  var service = this.services[serviceID];
  if (service == null) {
    if (callback) {
      return callback(new CdifError('service not found: ' + serviceID));
    }
  }
  // do not check this to allow event updates reach framework before device is connected
  // if (this.connected === false) {
  //   if (callback)
  //     callback(new Error('device not connected'));
  //   return;
  // }
  service.setServiceStates(values, callback);
};

// now support only one user / pass pair
// TODO: check if no other case than oauth redirect flow needs to temporarily unset connected flag
CdifDevice.prototype.connect = function(user, pass, callback) {
  if (this.connected === true) {
    if (this.spec.device.userAuth === true) {
      if (this.secret === '') {
        return callback(new CdifError('cannot verify password'), null, null);
      }
      if (this.user !== user) {
        return callback(new CdifError('username not match'), null, null);
      }
      this.auth.compareSecret(pass, this.secret, function(err, res) {
        if (!err && res === true) {
          return callback(null, this.secret, null);
        }
        if (!err) {
          return callback(new CdifError('password not match'), null, null);
        }
        return callback(new CdifError(err.message), null, null);
      }.bind(this));
    } else {
      callback(null, null, null);
    }
    return;
  }
  if (this._connect && typeof(this._connect) === 'function') {
    this._connect(user, pass, function(error, redirectObj) {
      if (error) {
        return callback(new DeviceError('connect fail: ' + error.message), null, null);
      }

      if (redirectObj) {
        if (redirectObj.href == null || redirectObj.method == null) {
          return callback(new DeviceError('redirect url malform: ' + JSON.stringify(redirectObj)), null, null);
        }
        this.redirecting = true;
      } else {
        this.connected = true;
      }

      if (this.spec.device.userAuth === true) {
        this.auth.getSecret(this.deviceID, pass, function(err, secret) {
          if (!err) {
            this.user = user;
            this.secret = secret;
          }
          callback(err, secret, redirectObj);
        }.bind(this));
      } else {
        callback(null, null, redirectObj);
      }
    }.bind(this));
  } else {
    if (this.spec.device.userAuth === true) {
      // TODO: may create auth strategy later on
      callback(new CdifError('cannot authenticate this device'), null, null);
    } else {
      this.connected = true;
      callback(null, null, null);
    }
  }
};

CdifDevice.prototype.disconnect = function(callback) {
  if (this.connected === true) {
    if (this._disconnect && typeof(this._disconnect) === 'function') {
      this._disconnect(function(error) {
        if (error) {
          return callback(new DeviceError('disconnect fail: ' + error.message));
        }
        if (this.spec.device.userAuth === true) {
          this.user = ''; this.secret = '';
        }
        this.connected = false;
        callback(null);
      }.bind(this));
    } else {
      if (this.spec.device.userAuth === true) {
        this.user = ''; this.secret = '';
      }
      this.connected = false;
      callback(null);
    }
  } else {
    callback(new CdifError('device not connected'));
  }
};

CdifDevice.prototype.getHWAddress = function(callback) {
  if (this._getHWAddress) {
    this._getHWAddress(function(error, data) {
      if (error) {
        return callback(new DeviceError('get hardware address fail: ' + error.message), null);
      }
      callback(null, data);
    });
  } else {
    callback(null, null);
  }
};

CdifDevice.prototype.deviceControl = function(serviceID, actionName, args, callback) {
  var service = this.services[serviceID];
  if (service == null) {
    return callback(new CdifError('service not found: ' + serviceID), null);
  }
  service.invokeAction(actionName, args, callback);
};

CdifDevice.prototype.updateDeviceSpec = function(newSpec) {
  this.spec = newSpec;
  this.initServices();
};

CdifDevice.prototype.setEventSubscription = function(serviceID, subscribe, unsubscribe) {
  if (typeof(subscribe) !== 'function' || typeof(unsubscribe) !== 'function') {
    return console.error('type error for event subscribers');
  }
  var service = this.services[serviceID];
  if (service) {
    service.setEventSubscription(subscribe.bind(this), unsubscribe.bind(this));
  } else {
    console.error('cannot set subscriber for: ' + serviceID);
  }
};

CdifDevice.prototype.subscribeDeviceEvent = function(subscriber, serviceID, callback) {
  var service = this.services[serviceID];
  if (service == null) {
    return callback(new CdifError('cannot subscribe to unknown serviceID: ' + serviceID));
  }

  service.subscribeEvent(subscriber.onChange, function(err) {
    if (!err) {
      service.addListener('serviceevent', subscriber.publish);
    }
    callback(err);
  });
};

CdifDevice.prototype.unSubscribeDeviceEvent = function(subscriber, serviceID, callback) {
  var service = this.services[serviceID];
  if (service == null) {
    return callback(new CdifError('cannot unsubscribe from unknown serviceID: ' + serviceID));
  }

  service.removeListener('serviceevent', subscriber.publish);
  if (service.listeners('serviceevent').length === 0) {
    service.unsubscribeEvent(callback);
  }
};

// get device root url string
CdifDevice.prototype.getDeviceRootUrl = function(callback) {
  if (this.spec.device.devicePresentation !== true || typeof(this._getDeviceRootUrl) !== 'function') {
    return callback(new DeviceError('this device do not support presentation'), null);
  }
  this._getDeviceRootUrl(function(err, data) {
    if (err) {
      return callback(new DeviceError('get device root url failed: ' + err.message), null);
    }
    try {
      url.parse(data);
    } catch(e) {
      return callback(new DeviceError('device root url parse failed: ' + e.message), null);
    }
    callback(null, data);
  });
};

// get device root schema document object, must be sync
CdifDevice.prototype.getDeviceRootSchema = function() {
  if (typeof(this._getDeviceRootSchema) !== 'function') return null;
  return this._getDeviceRootSchema();
};

// resolve JSON pointer based schema ref and return the schema object associated with it
CdifDevice.prototype.resolveSchemaFromPath = function(path, self, callback) {
  var schemaDoc = this.schemaDoc;
  if (!schemaDoc) {
    return callback(new DeviceError('device has no schema doc'), self, null);
  }
  if (path === '/') {
    return callback(null, self, schemaDoc);
  }

  var doc = null;
  try {
    doc = JSON.parse(JSON.stringify(schemaDoc));
  } catch(e) {
    return callback(new DeviceError('invalid schema doc: ' + e.message), self, null);
  }

  var ref;
  var lead = path.charAt(0);

  //TODO: better do this with regex
  if (lead === '/') {
    ref = '#' + path;
  } else if (lead === '#') {
    ref = path;
  } else {
    return callback(new CdifError('path is not a valid pointer'), self, null);
  }

  doc.__ =  {
    "$ref": ref
  };

  try {
    parser.dereference(doc, {$refs: {external: false}}, function(err, out) {
      if (err) {
        return callback(new CdifError('pointer dereference fail: ' + err.message), self, null);
      }
      callback(null, self, out.__);
    });
  } catch (e) {
    return callback(new CdifError('pointer dereference fail: ' + e.message), self, null);
  }
};

CdifDevice.prototype.setOAuthAccessToken = function(params, callback) {
  if (typeof(this._setOAuthAccessToken) === 'function') {
    this._setOAuthAccessToken(params, function(err) {
      if (err) {
        return callback(new CdifError(err.message));
      }
      this.connected   = true;
      this.redirecting = false;
      callback(null);
    }.bind(this));
  } else {
    callback(new CdifError('cannot set device oauth access token: no available device interface'));
  }
};

CdifDevice.prototype.setDeviceTimeout = function(eventName, callback) {
  // do not allow parallel interface access
  if (this.listeners(eventName).length === 0) {
    this.installTimeout(eventName, callback, function(cb) {
      this.online = false;
      this.connected = false;
      this.removeAllListeners(eventName);
      delete this.timeout[eventName];
      cb(new DeviceError('device not responding'), null);
    }.bind(this));

    this.once(eventName, callback);
    return true;
  } else {
    callback(new CdifError('device in action'), null);
    return false;
  }
};

CdifDevice.prototype.installTimeout = function(eventName, cb, callback) {
  var name = 'nr_' + eventName;
  this.addListener(name, function(device, en, call_back) {
    device.removeAllListeners(en);
    callback(call_back);
  });

  var timeout = new Timeout(this, name, cb);
  this.timeout[eventName] = setTimeout(timeout.expire, 40000);
};

CdifDevice.prototype.clearDeviceTimeout = function(eventName) {
  var name = 'nr_' + eventName;
  this.removeAllListeners(name);
  clearTimeout(this.timeout[eventName]);
  delete this.timeout[eventName];
};

module.exports = CdifDevice;
