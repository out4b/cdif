var request = require('request');
var express = require('express');
var morgan  = require('morgan');
var url = require('url');

var urlObj = url.parse(process.argv[2]);
var app = express();

app.use(morgan('dev'));

//TODO: support https and handle https device root Url
// in real production this must be hosted on https
app.use('/', function(req, res) {
  var parsedUrl = url.parse(req.url);
  var headersCopy = {};
  // create a copy of request headers
  for (attr in req.headers) {
    if (!req.headers.hasOwnProperty(attr)) continue;
    headersCopy[attr] = req.headers[attr];
  }
  urlObj.path = req.url;
  var options = {
    uri: urlObj,
    method: req.method,
    path: parsedUrl.path,
    headers: headersCopy
  };

  var clientRequest = request(options);

  clientRequest.on('response', function(response) {
    res.statusCode = response.statusCode;
    for (header in response.headers) {
      if (!response.headers.hasOwnProperty(header)) continue;
      res.setHeader(header, response.headers[header]);
    }
    response.pipe(res);
  });
  req.pipe(clientRequest);
});

var listener = app.listen(function() {
  var appPort = listener.address().port;
  process.send({ port: appPort });
});
// is this available on non Ubuntu system?
process.setgid('nogroup');
process.setuid('nobody');
