var cp = require('child_process');
var events = require('events');
var util = require('util');
var ipUtil = require('ip-util');

function ProxyServer() {
  this.proxyUrl = '';
  // For now this is onvif only
  this.streamUrl = '';
}

util.inherits(ProxyServer, events.EventEmitter);

ProxyServer.prototype.createServer = function(path, callback) {
  try {
    this.server = cp.fork(path);
  } catch(e) {
    callback(e);
  }
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
    }
  }.bind(this));
  callback(null);
};

ProxyServer.prototype.setDeviceRootUrl = function(url) {
  this.server.send({deviceRootUrl: url});
};

// For now this is onvif only
ProxyServer.prototype.setDeviceStreamUrl = function(url) {
  this.server.send({deviceStreamUrl: url});
};

module.exports = ProxyServer;
