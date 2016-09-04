function SubscriberManager(io) {
  this.io             = io;
  this.subscriberList = [];
}

SubscriberManager.prototype.getSubscriber = function(id, io, info, callback) {
  if (this.subscriberList[id] == null) {
    var subscriber = new Subscriber(io, id, info);
    this.subscriberList[id] = subscriber;
    callback(subscriber);
  } else {
    callback(this.subscriberList[id]);
  }
}

SubscriberManager.prototype.removeSubscriber = function(id, callback) {
  var subscriber = this.subscriberList[id];
  if (subscriber == null) {
    callback(new Error('cannot remove non existed subscriber'));
  } else {
    callback(null, subscriber, subscriber.info);
    this.subscriberList[id] = null;
  }
}

function Subscriber(io, id, info) {
  this.io      = io;
  this.id      = id;
  this.info    = info;
  this.publish = this.publish.bind(this);
}

Subscriber.prototype.publish = function(updated, data) {
  if (updated || !this.info.onUpdate) {
    this.io.to(this.id).emit('event', data);
  }
};

module.exports = SubscriberManager;
