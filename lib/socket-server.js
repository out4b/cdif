var events = require('events');
var util = require('util');
var express = require('express');
var http = require('http');
var socketio = require('socket.io');
var jwt = require('jsonwebtoken');
var socketioJWT = require('socketio-jwt');

function SocketServer(server, deviceManager) {
  this.io = socketio.listen(server);
  this.deviceManager = deviceManager;
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
      var arr = room.split('/');
      var deviceID = arr[0];
      var serviceId = arr[1];
      console.log('client subscribe to events of deviceID: ' + deviceID + ', serviceId: '+ serviceId);
      _this.deviceManager.eventSubscribe(deviceID, serviceId, function(err) {
        socket.join(room, function() {
          if (!err) {
            _this.deviceManager.on('deviceevent', function(data) {
              _this.io.sockets.to(room).emit('event', data);
            });
          } else {
            console.log(err);
            _this.io.sockets.to(room).emit('error', err.message);
          }
        });
      });
    });
  });
}


module.exports = SocketServer;
