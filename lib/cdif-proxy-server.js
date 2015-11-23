var cp = require('child_process');
var events = require('events');
var util = require('util');
var ipUtil = require('ip-util');

function ProxyServer() {
  this.proxyUrl = '';
  this.streamUrl = '';
  this.server = cp.fork('./lib/proxy-app.js');
  this.server.on('message', function(msg) {
    if (msg.port) {
      var port = msg.port;
      var protocol = ipUtil.getHostProtocol();
      var hostIp = ipUtil.getHostIp();
      this.proxyUrl = protocol + hostIp + ':' + port;
      this.emit('proxyurl', this.proxyUrl);
    } else if (msg.streamUrl) {
      this.streamUrl = msg.streamUrl;
      this.emit('streamurl', this.streamUrl);
    }
  }.bind(this));
}

util.inherits(ProxyServer, events.EventEmitter);

ProxyServer.prototype.setDeviceRootUrl = function(url) {
  this.server.send({deviceRootUrl: url});
};

// For now below are onvif only
ProxyServer.prototype.setDeviceStreamUrl = function(url) {
  this.server.send({deviceStreamUrl: url});
};

module.exports = ProxyServer;
