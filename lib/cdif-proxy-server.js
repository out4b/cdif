var cp        = require('child_process');
var events    = require('events');
var util      = require('util');
var ipUtil    = require('./ip-util');
var CdifError = require('./error').CdifError;

function ProxyServer() {
  this.server    = null;
  this.proxyUrl  = '';
  // For now this is onvif only
  this.streamUrl = '';
}

util.inherits(ProxyServer, events.EventEmitter);

ProxyServer.prototype.createServer = function(path, callback) {
  try {
    this.server = cp.fork(path);

    this.server.on('message', function(msg) {
      if (msg.port) {
        var port = msg.port;
        var protocol = ipUtil.getHostProtocol();
        var hostIp = ipUtil.getHostIp();
        this.proxyUrl = protocol + hostIp + ':' + port;
        this.emit('proxyurl', this.proxyUrl);
      } else if (msg.streamUrl) {
        // For now this is onvif only
        this.streamUrl = msg.streamUrl;
        this.emit('streamurl', this.streamUrl);
      } else if (msg.error) {
        this.emit('error', msg.error);
      }
    }.bind(this));
  } catch(e) {
    if (typeof(callback) === 'function') {
      callback(new CdifError('proxy server create failed: ' + e.message));
    }
    return;
  }
  if (typeof(callback) === 'function') {
    callback(null);
  }
};

ProxyServer.prototype.killServer = function(callback) {
  if (this.server) {
    this.server.kill('SIGTERM');
  }
  callback(null);
};

ProxyServer.prototype.setDeviceID = function(id) {
  this.server.send({deviceID: id});
};

ProxyServer.prototype.setDeviceRootUrl = function(url) {
  this.server.send({deviceRootUrl: url});
};

// For now this is onvif only
ProxyServer.prototype.setDeviceStreamUrl = function(url) {
  this.server.send({deviceStreamUrl: url});
};

module.exports = ProxyServer;
