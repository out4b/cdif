var jwt = require('jsonwebtoken');

function DeviceAuth() {

}

DeviceAuth.prototype.generateToken = function(user, secret, callback) {
  //TODO: user configurable expire time
  // this alway success?
  var token = jwt.sign({ username: user }, secret, { expiresIn: 60 * 60 * 60 * 5 });
  callback(null, token);
};

DeviceAuth.prototype.verifyAccess = function(secret, token, callback) {
  if (typeof(token) !== 'string') {
    callback(new Error('no valid token'));
    return;
  }
  if (typeof(secret) !== 'string') {
    callback(new Error('not able to verify token'));
    return;
  }
  try {
    var decoded = jwt.verify(token, secret);
    callback(null);
  } catch(e) {
    callback(e);
  }
};

module.exports = DeviceAuth;
