var os         = require('os');
var util       = require('util');
var CdifDevice = require('cdif-device');
var logger     = require('./logger');

module.exports = {
  // if this host run as router it may need to return its WAN IP address
  getHostIp: function() {
    var interfaces = os.networkInterfaces();
    for (var k in interfaces) {
      for (var k2 in interfaces[k]) {
        var address = interfaces[k][k2];
          if (address.family === 'IPv4' && !address.internal) {
            // only return the first available IP
            return address.address;
          }
      }
    }
  },
  getHostProtocol: function() {
    // in production return https instead
    return 'http://';
  },
  getHostPort: function() {
    //TODO: check port availability
    return '3049';
  },
  inherits: function(constructor, superConstructor) {
    util.inherits(constructor, superConstructor);

    // prevent child override
    if (superConstructor === CdifDevice) {
      for (var i in superConstructor.prototype) {
        constructor.prototype[i] = superConstructor.prototype[i];
      }
    }
  },
  loadFile: function(name) {
    // avoid entering global require cache
    // to be used by device modules to reload its impl. files on module reload
    try {
      return require(name);
    } catch (e) {
      logger.error(e);
      return null;
    }
  }
};
