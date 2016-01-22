var events            = require('events');
var util              = require('util');
var socketio          = require('socket.io');
var SubscriberManager = require('./subscriber');

function SocketServer(server, cdifInterface) {
  this.io                = socketio.listen(server);
  this.cdifInterface     = cdifInterface;
  this.subscriberManager = new SubscriberManager(this.io);
}

util.inherits(SocketServer, events.EventEmitter);

SocketServer.prototype.installHandlers = function() {
  var _this = this;

  //TODO: support event id, device / service info, timestamp, cancel and subscription expire time
  this.io.sockets.on('connection', function(socket) {
    socket.on('subscribe', function (options) {
      var info;
      try {
        info = JSON.parse(options);
      } catch (e) {
        return;
      }
      var deviceID = info.deviceID;
      var serviceID = info.serviceID;

      console.log('client subscribe to events of deviceID: ' + deviceID + ', serviceID: '+ serviceID);
      _this.subscriberManager.getSubscriber(socket.id, _this.io, info, function(subscriber) {
        //TODO: add token support
        _this.cdifInterface.eventSubscribe(subscriber, deviceID, serviceID, '', function(err) {
          if (err) {
            _this.io.to(socket.id).emit('error', err.message);
            _this.subscriberManager.removeSubscriber(socket.id, function(){});
          }
        });
      });
    });
    socket.on('disconnect', function() {
      console.log('client disconnect');
      _this.subscriberManager.removeSubscriber(socket.id, function(err, subscriber, info) {
        if (!err) {
          var deviceID = info.deviceID;
          var serviceID = info.serviceID;
          //TODO: add token support
          _this.cdifInterface.eventUnsubscribe(subscriber, deviceID, serviceID, '', function(err) {
          });
        }
      });
    });
  });
};


module.exports = SocketServer;
