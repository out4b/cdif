var should  = require('should');
var request = require('supertest');

var url = 'http://localhost:3049';

var deviceList;

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

