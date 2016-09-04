var should = require('should');
var request = require('supertest');
var async = require('async');

var url = 'http://localhost:3049';

var deviceList;

describe('discover all devices', function() {
  this.timeout(3000);
  it('discover OK', function(done) {
    request(url).post('/discover').expect(200).end(function(err, res) {
      if(err) throw err;
      setTimeout(function() {
        request(url).post('/stop-discover').expect(200).end(function(err, res) {
          if(err) throw err;
          done();
        });
      }, 2000);
    });
  });
});

describe('get device list', function() {
  it('get device list OK', function(done) {
    request(url).get('/device-list')
    .expect('Content-Type', /json/)
    .expect(200).end(function(err, res) {
      if(err) throw err;
      for (var i in res.body) {
        res.body[i].should.have.property('configId').which.is.a.Number();
        res.body[i].should.have.property('specVersion').and.have.property('major', 1);
        res.body[i].should.have.property('specVersion').and.have.property('minor', 0);
        res.body[i].should.have.property('device');
        var device = res.body[i].device;
        device.should.have.property('deviceType');
        device.should.have.property('friendlyName');
        device.should.have.property('manufacturer');
        // device.should.have.property('modelName');
        device.should.have.property('userAuth');
        device.should.have.property('serviceList', {});
        // if (device.deviceType != 'urn:cdif-net:device:BinaryLight:1' &&
        //   device.deviceType != 'urn:cdif-net:device:DimmableLight:1' &&
        //   device.deviceType != 'urn:cdif-net:device:SensorHub:1' &&
        //   device.deviceType != 'urn:cdif-net:device:ONVIFCamera:1') {
        //     throw(new Error('unknown device type: ' + device.deviceType));
        //   }
      }
      deviceList = JSON.parse(JSON.stringify(res.body));
      done();
    });
  });
});

describe('connect all devices', function() {
  this.timeout(30000);

  it('connect OK', function(done) {
    var list = Object.keys(deviceList);
    var cred = {"username": "admin", "password": "test"};
    async.eachSeries(list, function(deviceID, callback) {
      var device = deviceList[deviceID].device;
      if (device.userAuth === true) {
        request(url).post('/device-control/' + deviceID + '/connect')
        .send(cred).expect(200, function(err, res) {
          if (err) throw err;
          var access_token = res.body.access_token;
          deviceList[deviceID].access_token = access_token;
          callback();
        });
      } else {
        request(url).post('/device-control/' + deviceID + '/connect')
        .expect(200, callback);
      }
    }, done);
  });
});

describe('invoke all actions', function() {
  this.timeout(0);

  it('invoke OK', function(done) {
    var list = Object.keys(deviceList);
    async.eachSeries(list, function(deviceID, callback) {
      request(url).get('/device-control/' + deviceID + '/get-spec')
      .send({"access_token": deviceList[deviceID].access_token})
      .expect(200, function(err, res) {
        if (err) throw err;
        var device = res.body.device;
        device.should.have.property('serviceList');
        device.serviceList.should.be.an.Object;
        device.serviceList.should.be.not.empty;
        var serviceList = [];
        for (var serviceID in device.serviceList) {
          serviceList.push(serviceID);
        }
        async.eachSeries(serviceList, function(serviceID, cb) {
          testInvokeActions(deviceID, serviceID, res.body.device.serviceList, cb);
        }, callback);
      });
    }, done);
  });
});

function testInvokeActions(deviceID, serviceID, serviceList, callback) {
  var actionList = serviceList[serviceID].actionList;
  actionList.should.be.an.Object;
  actionList.should.be.not.empty;

  var list = Object.keys(actionList);

  async.eachSeries(list, function(name, cb) {
    setTimeout(function() {
      var action = actionList[name];
      action.should.be.an.Object;
      action.should.be.not.empty;
      var args = action.argumentList;
      var req = { serviceID: serviceID,
        actionName: name,
        argumentList: {},
        access_token: deviceList[deviceID].access_token
      };
      for (var j in args) {
        var argName = j;
        argName.should.not.be.empty;
        var stateVarName = args[j].relatedStateVariable;
        var stateVarTable = serviceList[serviceID].serviceStateTable;
        stateVarTable.should.be.an.Object;
        stateVarTable.should.be.not.empty;
        var stateVar = stateVarTable[stateVarName];
        stateVar.should.be.an.Object;
        stateVar.should.be.not.empty;
        if (stateVar.dataType === 'number' ||
        stateVar.dataType === 'uint8' ||
        stateVar.dataType === 'uint16' ||
        stateVar.dataType === 'uint32' ||
        stateVar.dataType === 'sint8' ||
        stateVar.dataType === 'sint16' ||
        stateVar.dataType === 'sint32'
      ) {
        var min = 0; var max = 100;
        if (stateVar.allowedValueRange) {
          stateVar.allowedValueRange.minimum.should.be.a.Number;
          stateVar.allowedValueRange.maximum.should.be.a.Number;
          min = stateVar.allowedValueRange.minimum;
          max = stateVar.allowedValueRange.maximum;
        }
        req.argumentList[argName] = Math.floor(Math.random() * max) + min;
      } else if (stateVar.dataType === 'boolean') {
        req.argumentList[argName] = Math.random() >= 0.5;
      } else if (stateVar.dataType === 'string') {
        if (stateVar.defaultValue) {
          req.argumentList[argName] = stateVar.defaultValue;
        } else {
          req.argumentList[argName] = 'test';
        }
      } else if (stateVar.dataType === 'object') {
        req.argumentList[argName] = {};   // fix this after we have object type schema
      } else if (stateVar.dataType === 'url') {
        req.argumentList[argName] = 'http://test.com';
      }
    }
    console.log('Request:' + JSON.stringify(req));
    request(url).post('/device-control/' + deviceID + '/invoke-action')
    .send(req)
    .expect('Content-Type', /[json | text]/)
    .expect(200, function(err, res) {
      if (err) {
        console.error(err);
      }
      console.log('Response: ' + JSON.stringify(res.body));
      cb();
    });
  }, 5000);
}, callback);
}
