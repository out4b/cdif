function SubscriberManager(io) {
  this.io = io;
  this.subscriberList = {};
}

SubscriberManager.prototype.getSubscriber = function(room) {
  var onChange = JSON.parse(room).onChange;
  if (this.subscriberList[room] == null) {
    var subscriber = new Subscriber(this.io, room, onChange);
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
    if (updated || !this.onChange) {
      this.io.sockets.to(this.room).emit('event', data);
    }
  }.bind(this);
}

module.exports = SubscriberManager;
