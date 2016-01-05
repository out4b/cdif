var events      = require('events');
var util        = require('util');
var url         = require('url');
var parser      = require('json-schema-ref-parser');
var CdifError   = require('./error').CdifError;
var DeviceError = require('./error').DeviceError;
var Service     = require('./service');

//warn: try not add event listeners in this class
function CdifDevice(spec) {
  this.spec        = spec;
  this.deviceID    = '';
  this.user        = '';
  this.secret      = '';
  this.connected   = false;
  this.connections = 0;
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
    callback(new CdifError('cannot get device spec'), null);
  } else {
    console.log('device name: ' + this.spec.device.friendlyName + ' deviceID: ' + this.deviceID);
    callback(null, this.spec);
  }
};

CdifDevice.prototype.getServiceStates = function(serviceID, callback) {
  if (callback && typeof(callback) !== 'function') {
    console.error('not valid callback');
    return;
  }
  var service = this.services[serviceID];
  if (service == null) {
    if (callback)
      callback(new CdifError('service not found: ' + serviceID), null);
    return;
  }
  if (this.connected === false) {
    if (callback)
      callback(new CdifError('device not connected'), null);
    return;
  }
  service.getServiceStates(callback);
};

CdifDevice.prototype.setServiceStates = function(serviceID, values, callback) {
  if (callback && typeof(callback) !== 'function') {
    console.error('not valid callback');
    return;
  }
  var service = this.services[serviceID];
  if (service == null) {
    if (callback)
      callback(new CdifError('service not found: ' + serviceID));
    return;
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
CdifDevice.prototype.connect = function(user, pass, callback) {
  if (this.connected === true) {
    if (this.spec.device.userAuth === true) {
      if (this.secret === '') {
        callback(new CdifError('cannot verify password'), null);
        return;
      }
      if (this.user !== user) {
        callback(new CdifError('username not match'), null);
        return;
      }
      this.auth.compareSecret(pass, this.secret, function(err, res) {
        if (!err && res === true) {
          this.connections++;
          callback(null, this.secret);
        } else {
          if (!err) {
            callback(new CdifError('password not match'), null);
          } else {
            callback(new CdifError(err.message), null);
          }
        }
      }.bind(this));
    } else {
      this.connections++;
      callback(null, null);
    }
    return;
  }
  if (this._connect && typeof(this._connect) === 'function') {
    this._connect(user, pass, function(error) {
      if (error) {
        callback(new DeviceError('connect fail: ' + error.message), null);
        return;
      }

      this.connected = true;
      this.connections++;

      if (this.spec.device.userAuth === true) {
        this.auth.getSecret(this.deviceID, pass, function(err, secret) {
          if (!err) {
            this.user = user;
            this.secret = secret;
          }
          callback(err, secret);
        }.bind(this));
      } else {
        callback(null, null);
      }
    }.bind(this));
  } else {
    if (this.spec.device.userAuth === true) {
      // TODO: may create auth strategy later on
      callback(new CdifError('cannot authenticate this device'), null);
    } else {
      this.connected = true;
      this.connections++;
      callback(null, null);
    }
  }
};

CdifDevice.prototype.disconnect = function(callback) {
  if (this.connected === true) {
    this.connections--;
    if (this.connections <= 0) {
      if (this._disconnect && typeof(this._disconnect) === 'function') {
        this._disconnect(function(error) {
          if (!error) {
            if (this.spec.device.userAuth === true) {
              this.user = ''; this.secret = '';
            }
            this.connected = false;
            callback(null);
          } else {
            callback(new DeviceError('disconnect fail: ' + error.message));
          }
        }.bind(this));
      } else {
        if (this.spec.device.userAuth === true) {
          this.user = ''; this.secret = '';
        }
        this.connected = false;
        callback(null);
      }
    } else {
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
        callback(new DeviceError('get hardware address fail: ' + error.message), null);
        return;
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
    callback(new CdifError('service not found: ' + serviceID), null);
    return;
  }
  service.invokeAction(actionName, args, function(err, data) {
    callback(err, data);
  });
};

CdifDevice.prototype.updateDeviceSpec = function(newSpec) {
  this.spec = newSpec;
  this.initServices();
};

CdifDevice.prototype.setEventSubscription = function(serviceID, subscribe, unsubscribe) {
  if (typeof(subscribe) !== 'function' || typeof(unsubscribe) !== 'function') {
    console.error('type error for event subscribers');
    return;
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
    callback(new CdifError('cannot subscribe to unknown serviceID: ' + serviceID));
    return;
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
    callback(new CdifError('cannot unsubscribe from unknown serviceID: ' + serviceID));
    return;
  }

  service.removeListener('serviceevent', subscriber.publish);
  if (service.listeners('serviceevent').length === 0) {
    service.unsubscribeEvent(callback);
  }
};

// get device root url string
CdifDevice.prototype.getDeviceRootUrl = function(callback) {
  if (this.spec.device.devicePresentation !== true || typeof(this._getDeviceRootUrl) !== 'function') {
    callback(new DeviceError('this device do not support presentation'), null);
    return;
  }
  this._getDeviceRootUrl(function(err, data) {
    if (err) {
      callback(new DeviceError('get device root url failed: ' + err.message), null);
      return;
    }
    try {
      url.parse(data);
      callback(null, data);
    } catch(e) {
      callback(new DeviceError('device root url parse failed: ' + e.message), null);
    }
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
    callback(new DeviceError('device has no schema doc'), self, null);
    return;
  }
  if (path === '/') {
    callback(null, self, schemaDoc);
    return;
  }

  var doc = null;
  try {
    doc = JSON.parse(JSON.stringify(schemaDoc));
  } catch(e) {
    callback(new DeviceError('invalid schema doc: ' + e.message), self, null);
    return;
  }

  var ref;
  var lead = path.charAt(0);

  //TODO: better do this with regex
  if (lead === '/') {
    ref = '#' + path;
  } else if (lead === '#') {
    ref = path;
  } else {
    callback(new CdifError('path is not a valid pointer'), self, null);
  }

  doc.__ =  {
    "$ref": ref
  };

  try {
    parser.dereference(doc, {$refs: {external: false}}, function(err, out) {
      if (err) {
        callback(new CdifError('pointer dereference fail: ' + err.message), self, null);
      } else {
        callback(null, self, out.__);
      }
    });
  } catch (e) {
    callback(new CdifError('pointer dereference fail: ' + e.message), self, null);
  }
};

module.exports = CdifDevice;
