var jwt       = require('jsonwebtoken');
var bcrypt    = require('bcrypt');
var CdifError = require('./error').CdifError;

function DeviceAuth(deviceDB) {
  this.deviceDB = deviceDB;
}

DeviceAuth.prototype.generateToken = function(user, secret, callback) {
  //TODO: user configurable expire time?
  // this alway success?
  var token = jwt.sign({ username: user }, secret, { expiresIn: 60 * 60 * 60 * 5 });
  callback(null, token);
};

DeviceAuth.prototype.verifyAccess = function(secret, token, callback) {
  if (typeof(token) !== 'string') {
    return callback(new CdifError('not a valid token'));
  }
  if (typeof(secret) !== 'string') {
    return callback(new CdifError('not able to verify token'));
  }
  try {
    var decoded = jwt.verify(token, secret);
  } catch(e) {
    return callback(new CdifError(e.message));
  }
  callback(null);
};

DeviceAuth.prototype.compareSecret = function(pass, secret, callback) {
  bcrypt.compare(pass, secret, callback);
};

DeviceAuth.prototype.getSecret = function(deviceID, pass, callback) {
  var error = null;
  var _this = this;

  this.deviceDB.loadSecret(deviceID, function(err, data) {
    if (err) {
      return callback(new CdifError(err.message), null);
    }
    if (!data) {
      bcrypt.hash(pass, 8, function(e, secret) {
        if (e) {
          callback(new CdifError(e.message), null);
        } else {
          _this.deviceDB.storeSecret(deviceID, secret, function(error) {
            if (error) {
              callback(new CdifError(error.message), null);
            } else {
              callback(null, secret);
            }
          });
        }
      });
    } else {
      bcrypt.compare(pass, data.hash, function(err, res) {
        if (err) {
          callback(new CdifError(err.message), null);
        } else if (res === false) {  // user changed password or token updated
          bcrypt.hash(pass, 8, function(e, s) {
            if (e) {
              callback(new CdifError(e.message), null);
            } else {
              _this.deviceDB.storeSecret(deviceID, s, function(err) {
                if (err) {
                  callback(new CdifError(err.message), null);
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
