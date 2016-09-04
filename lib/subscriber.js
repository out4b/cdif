function SubscriberManager(io) {
  this.io             = io;
  this.subscriberList = {};
}

SubscriberManager.prototype.getSubscriber = function(id, io, info, callback) {
  if (this.subscriberList[id] == null) {
    var subscriber = new Subscriber(io, id, info);
    this.subscriberList[id] = subscriber;
    callback(subscriber);
  } else {
    callback(this.subscriberList[id]);
  }
};

SubscriberManager.prototype.removeSubscriber = function(id, callback) {
  var subscriber = this.subscriberList[id];
  if (subscriber == null) {
    return callback(new Error('cannot remove non existed subscriber'));
  }
  callback(null, subscriber, subscriber.info);
  this.subscriberList[id] = null;
};

function Subscriber(io, id, info) {
  this.io      = io;
  this.id      = id;
  this.info    = info;
  this.publish = this.publish.bind(this);
}

Subscriber.prototype.publish = function(updated, deviceID, serviceID, data) {
  if (updated || !this.info.onUpdate) {
    this.io.to(this.id).emit('event', {timeStamp: Date.now(), deviceID: deviceID, serviceID: serviceID, eventData: data});
  }
};

module.exports = SubscriberManager;
