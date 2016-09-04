function Subscriber(ws, options) {
  this.ws      = ws;
  this.options = options;
  this.publish = this.publish.bind(this);
}

Subscriber.prototype.publish = function(updated, deviceID, serviceID, data) {
  // only send updated data, subject to change if we need to do api logging
  console.log('XXX: ' + data);
  if (updated) {
    this.ws.send(JSON.stringify({timeStamp: Date.now(), deviceID: deviceID, serviceID: serviceID, eventData: data}));
  }
};

function WSSubscriberManager() {
  this.subscriberList = {};
}

WSSubscriberManager.prototype.getSubscriber = function(ws, options, callback) {
  var deviceID  = options.deviceID;
  var serviceID = options.serviceID;
  var optionKey = deviceID + '/' + serviceID;

  if (this.subscriberList[ws] && this.subscriberList[ws][optionKey]) {
    return callback(this.subscriberList[ws][optionKey]);
  }

  var subscriber = new Subscriber(ws, options);

  if (this.subscriberList[ws] == null) {
    this.subscriberList[ws] = {};
  }

  this.subscriberList[ws][optionKey] = subscriber;
  return callback(subscriber);
};

WSSubscriberManager.prototype.findEventSubscriber = function(ws, options, callback) {
  var deviceID  = options.deviceID;
  var serviceID = options.serviceID;
  var optionKey = deviceID + '/' + serviceID;

  if (!this.subscriberList[ws] || !this.subscriberList[ws][optionKey]) {
    return callback(null);
  }
  return callback(this.subscriberList[ws][optionKey]);
};

WSSubscriberManager.prototype.removeSubscriber = function(subscriber, callback) {
  var ws = subscriber.ws;
  var deviceID  = subscriber.options.deviceID;
  var serviceID = subscriber.options.serviceID;
  var optionKey = deviceID + '/' + serviceID;

  delete this.subscriberList[ws][optionKey];

  callback(null, subscriber, subscriber.options);
};

WSSubscriberManager.prototype.findAllEventSubsribers = function(ws, callback) {
  callback(null, this.subscriberList[ws]);
}

module.exports = WSSubscriberManager;
