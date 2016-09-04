function SubscriberManager(io) {
  this.io = io;
  this.subscriberList = [];
}

SubscriberManager.prototype.getSubscriber = function(id, io, info, callback) {
  if (this.subscriberList[id] == null) {
    var subscriber = new Subscriber(io, id, info);
    this.subscriberList[id] = subscriber;
    console.log('add socket id: ' + id);
    callback(subscriber);
  } else {
    console.log('found existing socket id: ' + id);
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
    console.log('removed socket id: ' + id);
  }
}

function Subscriber(io, id, info) {
  this.io = io;
  this.id = id;
  this.info = info;
  this.publish = this.publish.bind(this);
}

Subscriber.prototype.publish = function(updated, data) {
  if (updated || !this.info.onUpdate) {
    this.io.to(this.id).emit('event', data);
  }
};

module.exports = SubscriberManager;
