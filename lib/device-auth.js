var jwt    = require('jsonwebtoken');
var bcrypt = require('bcrypt');

function DeviceAuth(deviceDB) {
  this.deviceDB = deviceDB;
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

DeviceAuth.prototype.compareSecret = function(pass, secret, callback) {
  bcrypt.compare(pass, secret, callback);
};

DeviceAuth.prototype.getSecret = function(deviceID, pass, callback) {
  var error = null;
  var _this = this;

  this.deviceDB.loadSecret(deviceID, function(err, data) {
    if (err) {
      callback(err, null);
      return;
    }
    if (!data) {
      bcrypt.hash(pass, 8, function(e, secret) {
        if (e) {
          callback(e, null);
        } else {
          _this.deviceDB.storeSecret(deviceID, secret, function(error) {
            if (err) {
              callback(error, null);
            } else {
              callback(null, secret);
            }
          });
        }
      });
    } else {
      bcrypt.compare(pass, data.hash, function(err, res) {
        if (err) {
          callback(err, null);
        } else if (res === false) {  // user changed password
          bcrypt.hash(pass, 8, function(e, s) {
            if (e) {
              callback(e, null);
            } else {
              _this.deviceDB.storeSecret(deviceID, s, function(err) {
                if (err) {
                  callback(err, null);
                } else {
                  callback(null, s);
                }
              });
            }
          });
        } else {
          callback(null, data.hash);
        }
      });
    }
  });
};

module.exports = DeviceAuth;
