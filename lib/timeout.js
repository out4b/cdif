function Timeout(device, eventName, cb) {
  this.device = device;
  this.en = eventName;
  this.cb = cb;
  this.expire = function() {
    this.device.emit(this.en, this.device, this.en, this.cb);
  }.bind(this);
}

module.exports = Timeout;
