function Subscriber(ws, clientKey, options) {
  this.ws        = ws;
  this.clientKey = clientKey;
  this.options   = options;
  this.publish   = this.publish.bind(this);
}

Subscriber.prototype.publish = function(updated, deviceID, serviceID, data) {
  // only send updated data, subject to change if we need to do api logging
  if (updated) {
    this.ws.send(JSON.stringify({timeStamp: Date.now(), deviceID: deviceID, serviceID: serviceID, eventData: data}));
  }
};

function WSSubscriberManager() {
  this.subscriberList = {};
}

WSSubscriberManager.prototype.getEventSubscriber = function(ws, clientKey, options, callback) {
  var deviceID  = options.deviceID;
  var serviceID = options.serviceID;
  var optionKey = deviceID + '/' + serviceID;

  if (this.subscriberList[clientKey] && this.subscriberList[clientKey][optionKey]) {
    return callback(this.subscriberList[clientKey][optionKey], false);
  }

  var subscriber = new Subscriber(ws, clientKey, options);

  if (this.subscriberList[clientKey] == null) {
    this.subscriberList[clientKey] = {};
  }

  this.subscriberList[clientKey][optionKey] = subscriber;
  return callback(subscriber, true);
};

WSSubscriberManager.prototype.findEventSubscriber = function(ws, clientKey, options, callback) {
  var deviceID  = options.deviceID;
  var serviceID = options.serviceID;
  var optionKey = deviceID + '/' + serviceID;

  if (!this.subscriberList[clientKey] || !this.subscriberList[clientKey][optionKey]) {
    return callback(null);
  }
  return callback(this.subscriberList[clientKey][optionKey]);
};

WSSubscriberManager.prototype.removeEventSubscriber = function(subscriber, callback) {
  var clientKey = subscriber.clientKey;
  var deviceID  = subscriber.options.deviceID;
  var serviceID = subscriber.options.serviceID;
  var optionKey = deviceID + '/' + serviceID;

  delete this.subscriberList[clientKey][optionKey];

  callback(null, subscriber, subscriber.options);
};

WSSubscriberManager.prototype.findAllEventSubsribers = function(ws, clientKey, callback) {
  callback(null, this.subscriberList[clientKey]);
}

module.exports = WSSubscriberManager;
