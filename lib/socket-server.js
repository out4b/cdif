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
  this.rooms = {};

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
    var room;
    socket.on('subscribe', function (options) {
      var info;
      try {
        info = JSON.parse(options);
      } catch (e) {
        return;
      }
      var deviceID = info.deviceID;
      var serviceID = info.serviceID;
      room = JSON.stringify([deviceID, serviceID]);

      console.log('client subscribe to events of deviceID: ' + deviceID + ', serviceID: '+ serviceID);
      _this.subscriberManager.getSubscriber(socket, _this.io, info, function(subscriber) {
        socket.join(room);
        if (_this.rooms[room] == null) {
          _this.deviceManager.eventSubscribe(subscriber, deviceID, serviceID, function(err) {
            if(err) {
              _this.io.sockets.to(room).emit('error', err.message);
            } else {
              _this.rooms[room] = room;
            }
          });
        }
      });
    });
    socket.on('disconnect', function() {
      _this.subscriberManager.removeSubscriber(socket, function(err, subscriber, info) {
        if (!err) {
          var deviceID = info.deviceID;
          var serviceID = info.serviceID;
          _this.deviceManager.eventUnsubscribe(subscriber, deviceID, serviceID, function(err) {
            if (err) {
              _this.io.sockets.to(room).emit('error', err.message);
            } else {
              _this.rooms[room] = null;
            }
          });
        }
      });
    });
  });
}


module.exports = SocketServer;
