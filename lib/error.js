function CdifError(message) {
  this.topic   = 'cdif error';
  this.message = message;
}
CdifError.prototype = new Error;

function DeviceError(message) {
  this.topic   = 'device error';
  this.message = message;
}
DeviceError.prototype = new Error;

module.exports = {
  CdifError: CdifError,
  DeviceError: DeviceError
};
