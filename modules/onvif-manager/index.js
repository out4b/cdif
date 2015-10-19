var events = require('events');
var util = require('util');
var fs = require('fs');

var onvif = require('onvif');
var Cam = onvif.Cam;
var cameras = [];


function OnvifManager() {
}

util.inherits(OnvifManager, events.EventEmitter);

OnvifManager.prototype.connect = function() {
    console.log("Connect OnvifManager!");
}

OnvifManager.prototype.deviceControl = function (dev, service, action, inputList, outputList){
    console.log("OnvifManager dev control");
    console.log(inputList);

    var cam = cameras[dev];
    if (service == 'urn:cdif-net:serviceID:ONVIFPTZService') {
        var options = {};
        options.x = inputList[0];
        options.y = inputList[1];
        options.z = inputList[2];
        cam.absoluteMove(options);
    }
}

OnvifManager.prototype.stopDiscoverDevices = function(callback) {
}

OnvifManager.prototype.discoverDevices = function(callback) {

    console.log("Hello OnvifManager!");

    onvif.Discovery.probe(function(err, cams) {
    if(err) { throw err; }

        cams.forEach(function(cam) {
            //FIXME: this user/pass info is just a test
            cam.username = 'admin';
            cam.password = 'xsVLX842';
            cam.connect(function(err) {
                if (err) {throw err;}
                cam.getDeviceInformation(function(err, info, xml) {
                    if (err) {throw err;}
                    console.log("Camera Info:  " + JSON.stringify(info));
                    fs.readFile('./onvif.json', 'utf8', function(err, data) {
                        if (err) { throw err; }
                        var devSpec = JSON.parse(data);
                        devSpec.device.friendlyName = info.manufacturer;
                        devSpec.device.manufacturer = info.manufacturer;
                        devSpec.device.modelDescription = info.model;
                        devSpec.device.serialNumber = info.serialNumber;
                        cameras[devSpec] = cam;
                        callback(devSpec);
                    });
                });
            });
        });
    });
}


module.exports = OnvifManager;
