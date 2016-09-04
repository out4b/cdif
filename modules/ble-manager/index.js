var util = require('util');
var events = require('events');
var NobleDevice = require('noble-device');
var YeelightBlue = require('yeelight-blue');

var connect = function(user, pass, callback) {
    this.device.connectAndSetup(function(err) {
        callback(err);
    });
};

var disconnect = function(callback) {
    this.device.disconnect(function(){
        callback(null);
    });
};

var getHWAddress = function(callback) {
    if (this.device._peripheral.address != null) {
        callback(null, this.device._peripheral.address);
    } else {
        callback(new Error('hw address not found'), null);
    }
};

function BleDeviceManager() {
    this.onDiscoverBleDevice = function(bleDevice) {
        var device;
        var peripheral = bleDevice._peripheral;
        //TODO: in the future device type check should follow GATT standard profiles
        if (YeelightBlue.is(peripheral)) {
            var yeelightBlueDevice = new YeelightBlue(bleDevice);
            device = yeelightBlueDevice;
        }
        // else if (localName === 'CC2650 SensorTag') {
        //     var spec = require('./cc2650.json');
        //     console.log('found cc2650');
        // }
        device.connect = connect.bind(device);
        device.disconnect = disconnect.bind(device);
        device.getHWAddress = getHWAddress.bind(device);
        this.emit('deviceonline', device, this);
    }.bind(this);
    this.discoverState = 'stopped';
}

util.inherits(BleDeviceManager, events.EventEmitter);

var BleDevice = function (peripheral) {
    NobleDevice.call(this, peripheral);
}

NobleDevice.Util.inherits(BleDevice, NobleDevice);

BleDeviceManager.prototype.discoverDevices = function() {
    if (this.discoverState === 'discovering') {
        return;
    }
    BleDevice.discoverAll(this.onDiscoverBleDevice);
    this.discoverState = 'discovering';
};

BleDeviceManager.prototype.stopDiscoverDevices = function() {
    BleDevice.stopDiscoverAll(this.onDiscoverBleDevice);
    this.discoverState = 'stopped';
};


module.exports = BleDeviceManager;
