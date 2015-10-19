var should = require('should');
var request = require('supertest');

var url = 'http://localhost:3049';

describe('discover all devices', function() {
  this.timeout(20000);
  it('return 200 OK', function(done) {
    request(url).post('/discover').expect(200).end(function(err, res) {
        if(err) throw err;
        setTimeout(function() {
          request(url).post('/stop-discover').expect(200).end(function(err, res) {
              if(err) throw err;
              done();
          });
        }, 15000);
    });
  });
});
