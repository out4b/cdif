function SubscriberManager(io) {
  this.io = io;
  this.subscriberList = {};
}

SubscriberManager.prototype.getSubscriber = function(room) {
  if (this.subscriberList[room] == null) {
    var subscriber = new Subscriber(io, room, room.onChange);
    this.subscriberList[room] = subscriber;
    return subscriber;
  } else {
    return this.subscriberList[room];
  }
}

function Subscriber(io, room, onChange) {
  this.io = io;
  this.room = room;
  this.onChange = onChange;
  this.onEvent = function(updated, data) {
    if (!this.onChange || updated) {
      io.sockets.to(room).emit('event', data);
    }
  };
}

module.exports = SubscriberManager;
