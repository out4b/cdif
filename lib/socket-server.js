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

  //TODO: handle client disconnect or subscription expires
  this.io.sockets.on('connection', function(socket) {
    socket.on('subscribe', function (room) {
      var roomObj;
      try {
        roomObj = JSON.parse(room);
      } catch (e) {
        return;
      }
      var deviceID = roomObj.deviceID;
      var serviceId = roomObj.serviceID;
      var onChange = roomObj.onChange;
      console.log('client subscribe to events of deviceID: ' + deviceID + ', serviceId: '+ serviceId);
      var subscriber = _this.subscriberManager.getSubscriber(room);
      socket.join(room, function() {
        _this.deviceManager.eventSubscribe(subscriber, deviceID, serviceId, function(err) {
          if(err) {
            _this.io.sockets.to(room).emit('error', err.message);
          }
        });
      });
    });
  });
}


module.exports = SocketServer;
