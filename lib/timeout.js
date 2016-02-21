function Timeout(device, eventName, callback) {
  this.device    = device;
  this.eventName = eventName;
  this.callback  = callback;
  this.expire = function() {
    this.device.emit(this.eventName, this.device, this.eventName, this.callback);
  }.bind(this);
}

module.exports = Timeout;
