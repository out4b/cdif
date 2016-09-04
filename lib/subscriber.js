function SubscriberManager(io) {
  this.io = io;
  this.subscriberList = {};
}

SubscriberManager.prototype.getSubscriber = function(socket, io, info, callback) {
  if (this.subscriberList[socket] == null) {
    var subscriber = new Subscriber(io, info);
    this.subscriberList[socket] = subscriber;
    callback(subscriber);
  } else {
    callback(this.subscriberList[socket]);
  }
}

SubscriberManager.prototype.removeSubscriber = function(socket, callback) {
  var subscriber = this.subscriberList[socket];
  if (subscriber == null) {
    callback(new Error('cannot remove non existed subscriber'));
  } else {
    callback(null, subscriber, subscriber.info);
    this.subscriberList[socket] = null;
  }
}

function Subscriber(io, info) {
  this.io = io;
  this.info = info;
  
  this.publish = function(updated, data) {
    var room = JSON.stringify([this.info.deviceID, this.info.serviceID]);
    if (updated || !this.info.onUpdate) {
      this.io.sockets.to(room).emit('event', data);
    }
  }.bind(this);
}

module.exports = SubscriberManager;
