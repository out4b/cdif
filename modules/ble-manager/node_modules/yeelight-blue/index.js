var util = require('util');
var CdifDevice = require('cdif-device');

var SERVICE_UUID          = 'fff0';
var CONTROL_UUID          = 'fff1';
var EFFECT_UUID           = 'fffc';

var YeelightBlue = function(bleDevice) {
  //TODO: this is just a convenient way to get device spec, in the future the spec should be dynamically generated from SDP service discovery result
  var spec = require('./yeelight-blue.json');
  CdifDevice.call(this, spec);
  this.device = bleDevice;
  this.actions['urn:cdif-net:serviceId:BinarySwitch']['getState'] = getYeelightBlueState.bind(this);
  this.actions['urn:cdif-net:serviceId:BinarySwitch']['setState'] = setYeelightBlueState.bind(this);
  this.actions['urn:cdif-net:serviceId:Dimming']['getLoadLevelState'] = getYeelightBlueBrightness.bind(this);
  this.actions['urn:cdif-net:serviceId:Dimming']['setLoadLevelState'] = setYeelightBlueBrightness.bind(this);
  this.actions['urn:yeelight-com:serviceId:ColorAdjust']['getColor'] = getYeelightBlueColor.bind(this);
  this.actions['urn:yeelight-com:serviceId:ColorAdjust']['setColor'] = setYeelightBlueColor.bind(this);
  this.state = {red: 255, green: 255, blue: 255, bright: 100};

};

YeelightBlue.SCAN_UUIDS = [SERVICE_UUID];

util.inherits(YeelightBlue, CdifDevice);

YeelightBlue.is = function(peripheral) {
  var localName = peripheral.advertisement.localName;

  return ((localName === undefined) || (localName === 'Yeelight Blu') || (localName === 'LightStrips'));
};

YeelightBlue.prototype.writeServiceStringCharacteristic = function(uuid, string, callback) {
  this.device.writeStringCharacteristic(SERVICE_UUID, uuid, string, callback);
};

YeelightBlue.prototype.writeControlCharateristic = function(red, green, blue, brightness, callback) {
  var command = util.format('%d,%d,%d,%d', red, green, blue, brightness);

  for (var i = command.length; i < 18; i++) {
    command += ',';
  }

  this.writeServiceStringCharacteristic(CONTROL_UUID, command, callback);
};

YeelightBlue.prototype.turnOn = function(callback) {
  this.writeControlCharateristic(255, 255, 255, 100, callback);
};

YeelightBlue.prototype.turnOff = function(callback) {
  console.log(this);
  this.writeControlCharateristic(0, 0, 0, 0, callback);
};

YeelightBlue.prototype.setColorAndBrightness = function(red, green, blue, brightness, callback) {
  this.writeControlCharateristic(red, green, blue, brightness, callback);
};

YeelightBlue.prototype.setGradualMode = function(on, callback) {
  this.device.writeServiceStringCharacteristic(EFFECT_UUID, on ? 'TS' : 'TE', callback);
};

var getYeelightBlueBrightness = function(args, callback) {
    var output = {};
    output['loadLevelState'] = this.state.bright;
    callback(null, output);
};

var setYeelightBlueBrightness = function(args, callback) {
    var _this = this;
    var bright = args.newLoadLevelState;
    var red = this.state.red;
    var green = this.state.green;
    var blue = this.state.blue;

    this.setColorAndBrightness(red, green, blue, bright, function(err) {
        if (!err) {
            _this.state.bright = bright;
        }
        callback(err);
    });
};

var getYeelightBlueColor = function(args, callback) {
    var output = {};
    output['red'] = this.state.red;
    output['green'] = this.state.green;
    output['blue'] = this.state.blue;
    callback(null, output);
};

var setYeelightBlueColor = function(args, callback) {
    var _this = this;
    var red = args.red;
    var green = args.green;
    var blue = args.blue;
    var bright = this.state.bright;
    this.setColorAndBrightness(red, green, blue, bright, function(err) {
        if (!err) {
            _this.state.red = red;
            _this.state.green = green;
            _this.state.blue = blue;
        }
        callback(err);
    });
};

var getYeelightBlueState = function(args, callback) {
    var output = {};
    if (this.state.bright > 0) {
        output['stateValue'] = true;
    } else {
        output['stateValue'] = false;
    }
    callback(null, output);
};

var setYeelightBlueState = function(args, callback) {
    var _this = this;
    var arg = args.stateValue;
    if (arg == true) {
        this.turnOn(function(err) {
            if (!err) {
                _this.state.bright = 100;
            }
            callback(err);
        });
    } else if (arg == false) {
        this.turnOff(function(err) {
            if (!err) {
                _this.state.bright = 0;
            }
            callback(err);
        });
    }
};

module.exports = YeelightBlue;
