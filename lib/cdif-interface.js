var events      = require('events');
var util        = require('util');

var options       = require('./cli-options');
var DeviceManager = require('./device-manager');
var logger        = require('./logger');
var CdifError     = require('./error').CdifError;
var DeviceError   = require('./error').DeviceError;

function CdifInterface(mm) {
  this.deviceManager = new DeviceManager(mm);

  if (options.heapDump === true) {
    setInterval(function() {
      global.gc();
      logger.info('heap used: ' + process.memoryUsage().heapUsed);
      // heapdump.writeSnapshot('./' + Date.now() + '.heapsnapshot');
    }, 1 * 60 * 1000);
  }

  this.deviceManager.on('presentation', this.onDevicePresentation.bind(this));
}

util.inherits(CdifInterface, events.EventEmitter);

CdifInterface.prototype.discoverAll = function(session) {
  this.deviceManager.emit('discoverall', session.callback);
};

CdifInterface.prototype.stopDiscoverAll = function(session) {
  this.deviceManager.emit('stopdiscoverall', session.callback);
};

CdifInterface.prototype.getDiscoveredDeviceList = function(session) {
  this.deviceManager.emit('devicelist', session.callback);
};

CdifInterface.prototype.connectDevice = function(deviceID, user, pass, session) {
  var _this = this;
  var cdifDevice = this.deviceManager.deviceMap[deviceID];
  if (cdifDevice == null) {
    return session.callback(new CdifError('device not found: ' + deviceID));
  }

  if (cdifDevice.module.discoverState === 'discovering') {
    return session.callback(new CdifError('in discovering', null));
  }

  this.deviceManager.emit('connect', cdifDevice, user, pass, session);
};

CdifInterface.prototype.disconnectDevice = function(deviceID, token, session) {
  var cdifDevice = this.deviceManager.deviceMap[deviceID];

  if (cdifDevice == null) {
    return session.callback(new CdifError('device not found: ' + deviceID));
  }

  this.deviceManager.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      if (cdifDevice.connectionState !== 'redirecting') {
        return session.callback(err);
      }
    }
    this.deviceManager.emit('disconnect', cdifDevice, session);
  }.bind(this));
};

CdifInterface.prototype.invokeDeviceAction = function(deviceID, serviceID, actionName, args, token, session) {
  var cdifDevice = this.deviceManager.deviceMap[deviceID];

  this.deviceManager.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      return session.callback(err);
    }
    this.deviceManager.emit('invokeaction', cdifDevice, serviceID, actionName, args, session);
  }.bind(this));
};

CdifInterface.prototype.getDeviceSpec = function(deviceID, token, session) {
  var cdifDevice = this.deviceManager.deviceMap[deviceID];

  this.deviceManager.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      return session.callback(err);
    }
    this.deviceManager.emit('getspec', cdifDevice, session);
  }.bind(this));
};

CdifInterface.prototype.getDeviceState = function(deviceID, serviceID, token, session) {
  var cdifDevice = this.deviceManager.deviceMap[deviceID];

  this.deviceManager.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      return session.callback(err);
    }
    this.deviceManager.emit('getstate', cdifDevice, serviceID, session);
  }.bind(this));
};

CdifInterface.prototype.eventSubscribe = function(subscriber, deviceID, serviceID, token, session) {
  var cdifDevice = this.deviceManager.deviceMap[deviceID];

  this.deviceManager.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      return session.callback(err);
    }
    this.deviceManager.emit('subscribe', subscriber, cdifDevice, serviceID, session);
  }.bind(this));
};

CdifInterface.prototype.eventUnsubscribe = function(subscriber, deviceID, serviceID, token, session) {
  var cdifDevice = this.deviceManager.deviceMap[deviceID];

  this.deviceManager.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      return session.callback(err);
    }
    this.deviceManager.emit('unsubscribe', subscriber, cdifDevice, serviceID, session);
  }.bind(this));
};

CdifInterface.prototype.getDeviceSchema = function(deviceID, path, token, session) {
  var cdifDevice = this.deviceManager.deviceMap[deviceID];

  this.deviceManager.ensureDeviceState(deviceID, token, function(err) {
    if (err) {
      return session.callback(err);
    }
    this.deviceManager.emit('getschema', cdifDevice, path, session);
  }.bind(this));
};

CdifInterface.prototype.setDeviceOAuthAccessToken = function(deviceID, params, session) {
  var cdifDevice = this.deviceManager.deviceMap[deviceID];

  if (cdifDevice == null) {  // check null or undefined
    return session.callback(new CdifError('device not found: ' + deviceID));
  }
  this.deviceManager.emit('setoauthtoken', cdifDevice, params, session);
};

CdifInterface.prototype.getDeviceRootUrl = function(deviceID, session) {
  var cdifDevice = this.deviceManager.deviceMap[deviceID];

  if (cdifDevice == null) {
    return session.callback(new CdifError('device not found: ' + deviceID));
  }
  this.deviceManager.emit('getrooturl', cdifDevice, session);
};

CdifInterface.prototype.onDevicePresentation = function(deviceID) {
  this.emit('presentation', deviceID);
};

module.exports = CdifInterface;
