var events            = require('events');
var util              = require('util');
var socketio          = require('socket.io');
var SubscriberManager = require('./subscriber');
var Session           = require('./session');
var logger            = require('./logger');

function SocketServer(server, cdifInterface) {
  this.io                = socketio.listen(server);
  this.cdifInterface     = cdifInterface;
  this.subscriberManager = new SubscriberManager(this.io);
}

util.inherits(SocketServer, events.EventEmitter);

SocketServer.prototype.installHandlers = function() {
  var _this = this;

  //TODO: support event id, cancel and subscription expire time
  this.io.sockets.on('connection', function(socket) {
    socket.on('subscribe', function (options) {
      var info;
      try {
        info = JSON.parse(options);
      } catch (e) {
        return;
      }
      var deviceID            = info.deviceID;
      var serviceID           = info.serviceID;
      var device_access_token = info.device_access_token;

      logger.info('client subscribe to events of deviceID: ' + deviceID + ', serviceID: '+ serviceID);
      _this.subscriberManager.getSubscriber(socket.id, _this.io, info, function(subscriber) {
        var session = new Session(null, null);

        session.callback = function(err) {
          if (err) {
            _this.io.to(socket.id).emit('error', {topic: err.topic, message: err.message});
            _this.subscriberManager.removeSubscriber(socket.id, function(){});
          }
        }

        _this.cdifInterface.eventSubscribe(subscriber, deviceID, serviceID, device_access_token, session);
      });
    });
    socket.on('disconnect', function() {
      _this.subscriberManager.removeSubscriber(socket.id, function(err, subscriber, info) {
        if (!err) {
          var deviceID            = info.deviceID;
          var serviceID           = info.serviceID;
          var device_access_token = info.device_access_token;

          var session = new Session(null, null);
          session.callback = function(err) {
            if (err) {
              logger.error('unsubscribe failed: ' + err.message);
            }
          }

          _this.cdifInterface.eventUnsubscribe(subscriber, deviceID, serviceID, device_access_token, session);
        }
      });
    });
  });
};


module.exports = SocketServer;
