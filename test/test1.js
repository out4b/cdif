var should = require('should');
var request = require('supertest');
var async = require('async');

var url = 'http://localhost:3049';

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
          device.should.have.property('modelName');
          device.should.have.property('userAuth');
          device.should.have.property('serviceList', {});
          if (device.deviceType != 'urn:cdif-net:device:BinaryLight:1' &&
            device.deviceType != 'urn:cdif-net:device:DimmableLight:1' &&
            device.deviceType != 'urn:cdif-net:device:SensorHub:1' &&
            device.deviceType != 'urn:cdif-net:device:ONVIFCamera:1') {
              throw(new Error('unknown device type: ' + device.deviceType));
            }
        }
        done();
    });
  });
});

describe('connect all devices', function() {
  this.timeout(5000);
  var deviceList;
  before(function(done) {
    request(url).get('/device-list')
    .expect('Content-Type', /json/)
    .expect(200).end(function(err, res) {
      if (err) throw err;
      deviceList = res.body;
      done();
    });
  });

  it('connect OK', function(done) {
    var list = [];
    for (var i in deviceList) {
      list.push(i);
    }
    async.eachSeries(list, function(deviceID, callback) {
      request(url).post('/device-control/' + deviceID + '/connect')
      .expect(200, callback);
    }, done);
  });
});

describe('invoke device actions', function() {
  this.timeout(15000);
  var deviceList;
  before(function(done) {
    request(url).get('/device-list')
    .expect('Content-Type', /json/)
    .expect(200).end(function(err, res) {
      if (err) throw err;
      deviceList = res.body;
      done();
    });
  });

  it('invoke OK', function(done) {
    var list = [];
    for (var i in deviceList) {
      list.push(i);
    }
    async.eachSeries(list, function(deviceID, callback) {
      request(url).get('/device-control/' + deviceID + '/get-spec')
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
        }, function(){});
        callback();
      });
    }, done);
  });
});
  //
  //
  // it('invoke OK', function(done) {
  //   request(url).get('/device-list')
  //   .expect('Content-Type', /json/)
  //   .expect(200).end(function(err, res) {
  //     var get_spec_tasks = [];
  //
  //     for (var deviceID in res.body) {
  //       var getSpec = function(cb) {
  //         request(url).get('/device-control/' + deviceID + '/get-spec')
  //         .set('Accept', 'application/json')
  //         .expect('Content-Type', /json/)
  //         .expect(200)
  //         .end(function(err, result) {
  //           if (err) throw err;
  //           cb(err, result.body, deviceID);
  //         });
  //       }
  //       get_spec_tasks.push(getSpec);
  //     }
  //     async.series(get_spec_tasks, done);
  //

      // var deviceList = Object.keys(res.body);
      // // for (var i = 0; i < deviceList.length; i++) {
      // //   var deviceID = deviceList[i];
      // //   request(url).get('/device-control/' + deviceList[i] + '/get-spec')
      // //   .expect('Content-Type', /json/)
      // //   .expect(200).end(function(err, res) {
      // //     if (err) throw err;
      // //     var device = res.body.device;
      // //     device.should.have.property('serviceList');
      // //     device.serviceList.should.be.an.Object;
      // //     device.serviceList.should.be.not.empty;
      // //     for (var serviceID in device.serviceList) {
      // //       testInvokeActions(deviceID, device.serviceList[serviceID], serviceID);
      // //     }
      // //     if (i == deviceList.length) {
      // //       done();
      // //     }
      // //   });
      // // }




function testInvokeActions(deviceID, serviceID, serviceList, callback) {
  var actionList = serviceList[serviceID].actionList;
  actionList.should.be.an.Object;
  actionList.should.be.not.empty;
  var list = [];
  for (var i in actionList) {
    list.push(i);
  }
  async.eachSeries(list, function(actionName, cb) {
    var action = actionList[actionName];
    action.should.be.an.Object;
    action.should.be.not.empty;
    var args = action.argumentList;
    var req = { serviceID: serviceID,
                actionName: i,
                argumentList: {}
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
      if (stateVar.dataType === 'number') {
        var min = 0; var max = 100;
        if (stateVar.allowedValueRange) {
          min = stateVar.allowedValueRange.minimum;
          max = stateVar.allowedValueRange.maximum;
        }
        req.argumentList[argName] = Math.floor(Math.random() * max) + min;
      } else if (stateVar.dataType === 'boolean') {
        req.argumentList[argName] = Math.random() >= 0.5;
      }
    }
    request(url).post('/device-control/' + deviceID + '/invoke-action')
    .send(req)
    .expect('Content-Type', /json/)
    .expect(200).end(function(err, res) {
      console.log(res.body);
      cb();
    });
  }, function(){});
  callback();
}
