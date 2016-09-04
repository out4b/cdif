var events = require('events');
var util = require('util');
var express = require('express');
var http = require('http');
var socketio = require('socket.io');
var jwt = require('jsonwebtoken');
var socketioJWT = require('socketio-jwt');
var SubscriberManager = require('./subscriber');

function SocketServer(server, deviceManager) {
  this.io = socketio.listen(server);
  this.deviceManager = deviceManager;
  this.subscriberManager = new SubscriberManager(this.io);

  var jwtSecret = 'big secret';

  // TODO: get profile and secret from hashed data store and check login attempt
  // ***following code is only used for concept proof***
  // ***not intended to use in any production environment

  // this.socket.use(socketioJWT.authorize({
  //   secret: jwtSecret,
  //   timeout: 60000,
  //   handshake: true
  // }));
}

util.inherits(SocketServer, events.EventEmitter);

SocketServer.prototype.installHandlers = function() {
  var _this = this;

  //TODO: support subscription inteval and expire time
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
        _this.deviceManager.eventSubscribe(subscriber, deviceID, serviceID, function(err) {
          if (err) {
            _this.io.to(socket.id).emit('error', err.message);
            _this.subscriberManager.removeSubscriber(socket.id, function(){});
          }
        });
      });
    });
    socket.on('disconnect', function() {
      _this.subscriberManager.removeSubscriber(socket.id, function(err, subscriber, info) {
        if (!err) {
          var deviceID = info.deviceID;
          var serviceID = info.serviceID;
          _this.deviceManager.eventUnsubscribe(subscriber, deviceID, serviceID, function(err) {
          });
        }
      });
    });
  });
}


module.exports = SocketServer;
