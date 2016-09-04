var jwt = require('jsonwebtoken');

function UserAuth() {

}

UserAuth.prototype.generateToken = function(user, pass, callback) {
  //TODO: user configurable expire time
  // this alway success?
  var token = jwt.sign({ username: user }, pass, { expiresIn: 60*60*5 });
  callback(null, token);
};

//this is synchronous
UserAuth.prototype.verifyAccess = function(cdifDevice, token, callback) {
  var userAuth = cdifDevice.spec.device.userAuth;
  if (userAuth === false) {
    callback(null);
  } else {
    if (!token) {
      callback(new Error('no valid token'));
    } else {
      try {
        var decoded = jwt.verify(token, cdifDevice.pass);
      } catch(err) {
        callback(err);
      }
      callback(null);
    }
  }
};

module.exports = UserAuth;
