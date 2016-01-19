function Timeout() {
  this.expire = function() {
    this.emit('norespond', this, this.module);
  };
}

module.exports = Timeout;
