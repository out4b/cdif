var events = require('events');
var util = require('util');
var express = require('express');
var http = require('http');
var socketio = require('socket.io');
var jwt = require('jsonwebtoken');
var socketioJWT = require('socketio-jwt');

//TODO: check port availability
var port = 8754;

function SocketServer(deviceManager) {
  this.deviceManager = deviceManager;
  var jwtSecret = 'big secret';
  var _this = this;

  this.server = http.createServer();
  this.server.listen(port);
  this.io = socketio.listen(this.server);

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

SocketServer.prototype.acceptSubscriptions = function() {
  var _this = this;

  this.io.sockets.on('connection', function(socket) {
    console.log('connected');
    socket.on('create', function (room) {
      console.log('room created');
      socket.join(room, function() {
        _this.io.sockets.to(room).emit('hello', 'xxx');
      });
    });
  });
}


module.exports = SocketServer;
