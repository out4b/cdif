var should  = require('should');
var request = require('supertest');
var async   = require('async');
var faker   = require('json-schema-faker');

var url = 'http://localhost:3049';

var deviceList;

describe('connect all devices', function() {
  this.timeout(30000);

  it('connect OK', function(done) {
  request(url).get('/device-list')
  .expect('Content-Type', /json/)
  .expect(200).end(function(err, res) {
      if(err) throw err;
      deviceList = JSON.parse(JSON.stringify(res.body));

      var list = Object.keys(deviceList);
      var cred = {"username": "admin", "password": "test"};
      async.eachSeries(list, function(deviceID, callback) {
        var device = deviceList[deviceID].device;
        if (device.userAuth === true) {
          request(url).post('/device-control/' + deviceID + '/connect')
          .send(cred).expect(200, function(err, res) {
            if (err) throw err;
            var device_access_token = res.body.device_access_token;
            deviceList[deviceID].device_access_token = device_access_token;
            callback();
          });
        } else {
          request(url).post('/device-control/' + deviceID + '/connect')
          .expect(200, callback);
        }
      }, done);
    });
  });
});

describe('invoke all actions', function() {
  this.timeout(0);

  it('invoke OK', function(done) {
    var list = Object.keys(deviceList);
    async.eachSeries(list, function(deviceID, callback) {
      request(url).get('/device-control/' + deviceID + '/get-spec')
      .send({"device_access_token": deviceList[deviceID].device_access_token})
      .expect(200, function(err, res) {
        if (err) throw err;
        var device = res.body.device;
        device.should.have.property('serviceList');
        device.serviceList.should.be.an.Object;
        device.serviceList.should.be.not.empty;
        var serviceList = Object.keys(device.serviceList);

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

      var argList = Object.keys(action.argumentList);
      var req = { serviceID: serviceID,
        actionName: name,
        argumentList: {},
        device_access_token: deviceList[deviceID].device_access_token
      };
      async.eachSeries(argList, function(arg, call_back) {
        arg.should.not.be.empty;
        var stateVarName = action.argumentList[arg].relatedStateVariable;
        var stateVarTable = serviceList[serviceID].serviceStateTable;
        stateVarTable.should.be.an.Object;
        stateVarTable.should.be.not.empty;
        var stateVar = stateVarTable[stateVarName];
        stateVar.should.be.an.Object;
        stateVar.should.be.not.empty;
        if (stateVar.dataType === 'number'  ||
            stateVar.dataType === 'integer' ||
            stateVar.dataType === 'uint8'   ||
            stateVar.dataType === 'uint16'  ||
            stateVar.dataType === 'uint32'  ||
            stateVar.dataType === 'sint8'   ||
            stateVar.dataType === 'sint16'  ||
            stateVar.dataType === 'sint32') {
          var min = 0; var max = 100;
          if (stateVar.allowedValueRange) {
            stateVar.allowedValueRange.minimum.should.be.a.Number;
            stateVar.allowedValueRange.maximum.should.be.a.Number;
            min = stateVar.allowedValueRange.minimum;
            max = stateVar.allowedValueRange.maximum;
          }
          if (stateVar.defaultValue) {
            req.argumentList[arg] = stateVar.defaultValue;
          } else {
            req.argumentList[arg] = Math.floor(Math.random() * max) + min;
          }
          call_back();
        } else if (stateVar.dataType === 'boolean') {
          req.argumentList[arg] = Math.random() >= 0.5;
          call_back();
        } else if (stateVar.dataType === 'string') {
          if (stateVar.defaultValue) {
            req.argumentList[arg] = stateVar.defaultValue;
          } else {
            req.argumentList[arg] = 'test';
          }
          call_back();
        } else if (stateVar.dataType === 'object') {
          var schemaRef = stateVar.schema;
          schemaRef.should.be.a.String;
          request(url).get('/device-control/' + deviceID + '/schema' + schemaRef)
          .send({"device_access_token": deviceList[deviceID].device_access_token})
          .expect(200, function(err, res) {
            if (err) throw err;
            var variableSchema = res.body;
            variableSchema.should.be.an.Object;
            variableSchema.should.be.not.empty;
            var fake_data = faker(variableSchema);
            console.log(fake_data);
            req.argumentList[arg] = fake_data;
            call_back();
          });
        }
      }, function() {
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
      });
    }, 5000);
  }, callback);
}
