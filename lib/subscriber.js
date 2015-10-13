var events = require('events');
var util = require('util');

function Subscriber(io, socket, room, onChange) {
  this.socket = socket;
  this.room = room;
  this.onChange = onChange;
  this.on('event', function(data) {
    io.sockets.to(room).emit('event', data);
  })
}

util.inherits(Subscriber, events.EventEmitter);

module.exports = Subscriber;
