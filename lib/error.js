module.exports = {
  CdifError: function(message) {
    this.topic   = 'cdif error';
    this.message = message;
  },
  DeviceError: function(message) {
    this.topic   = 'device error';
    this.message = message;
  }
};
