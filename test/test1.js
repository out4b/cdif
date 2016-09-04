var should = require('should');

describe('discover all devices', function() {
  it('should return -1 when the value is not present', function(done) {
    [1,2,3].indexOf(5).should.equal(-1);
    [1,2,3].indexOf(0).should.equal(-1);
    done();
  });
});
