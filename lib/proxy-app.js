var request = require('request');
var express = require('express');
var morgan  = require('morgan');
var url = require('url');
var ipUtil = require('ip-util');

var deviceUrl;
var deviceStreamUrl;
var app = express();

app.use(morgan('dev'));

process.on('message', function(msg) {
  if (msg.deviceRootUrl) {
    deviceUrl = url.parse(msg.deviceRootUrl);
    //TODO: support https and handle https device root Url
    // in real production this must be hosted on https
    //TODO: do token check once we have a common secure data store
    app.use('/', function(req, res) {
      var parsedUrl = url.parse(req.url);
      var headersCopy = {};
      // create a copy of request headers
      for (attr in req.headers) {
        if (!req.headers.hasOwnProperty(attr)) continue;
        headersCopy[attr] = req.headers[attr];
      }
      deviceUrl.path = req.url;
      var options = {
        uri: deviceUrl,
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
  } else if (msg.deviceStreamUrl) {
    deviceStreamUrl = url.parse(msg.deviceStreamUrl);
    process.send({streamUrl: 'ws://localhost:9999'});
  }
});

var listener = app.listen(function() {
  var appPort = listener.address().port;
  process.send({ port: appPort });
});
// is this available on non Ubuntu system?
process.setgid('nogroup');
process.setuid('nobody');
