function Timeout() {
  this.expire = function() {
    if (this.module) {
      this.module.emit('deviceoffline', this);
    }
  };
}

module.exports = Timeout;
