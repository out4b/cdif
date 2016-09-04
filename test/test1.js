var should = require('should');
var request = require('supertest');

var url = 'http://localhost:3049';

describe('discover all devices', function() {
  this.timeout(10000);
  it('return 200 OK', function(done) {
    request(url).post('/discover').expect(200).end(function(err, res) {
        if(err) throw err;
        setTimeout(function() {
          request(url).post('/stop-discover').expect(200).end(function(err, res) {
              if(err) throw err;
              done();
          });
        }, 9000);
    });
  });
});

describe('get device list', function() {
  it('return 200 OK', function(done) {
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
        }
        done();
    });
  });
});
