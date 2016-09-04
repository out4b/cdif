var events = require('events');
var util = require('util');
var http = require('http');
var express = require('express');
var request = require('request');
var url = require('url');
var bodyParser = require('body-parser');
var morgan = require('morgan');
var SocketServer = require('./socket-server');

//TODO: check port availability
var appPort      = 3049;

var loginRoute = '/login';
var discoverRoute = '/discover';
var stopDiscoverRoute = '/stop-discover';
var deviceListRoute = '/device-list';
var deviceControlRoute = '/device-control';
var connectRoute = '/connect';
var disconnectRoute = '/disconnect';
var actionInvokeRoute = '/invoke-action';
var eventSubRoute    = '/event-sub';
var eventUnsubRoute    = '/event-unsub';
var getDeviceSpecRoute = '/get-spec';
var getStateRoute = '/get-state';

function RouteManager(deviceManager) {
  this.app = express();
  this.deviceManager = deviceManager;
  this.loginRouter = express.Router();
  this.discoverRouter = express.Router();
  this.stopDiscoverRouter = express.Router();
  this.deviceListRouter = express.Router();
  this.deviceControlRouter = express.Router();
  this.connectRouter = express.Router({mergeParams: true});
  this.disconnectRouter = express.Router({mergeParams: true});
  this.actionInvokeRouter = express.Router({mergeParams: true});
  this.getDeviceSpecRouter = express.Router({mergeParams: true});
  this.getStateRouter = express.Router({mergeParams: true});
  this.eventSubRouter = express.Router({mergeParams: true});
  this.eventUnsubRouter = express.Router({mergeParams: true});
  this.presentationRouter = express.Router({mergeParams: true});

  this.server = http.createServer(this.app);

  this.app.use(morgan('dev'));
  this.app.use(bodyParser.json());
  // global routes
  this.app.use(loginRoute, this.loginRouter);
  this.app.use(discoverRoute, this.discoverRouter);
  this.app.use(stopDiscoverRoute, this.stopDiscoverRouter);
  this.app.use(deviceListRoute, this.deviceListRouter);
  this.app.use(deviceControlRoute, this.deviceControlRouter);
  //per device routes
  this.deviceControlRouter.use('/:deviceID' + connectRoute, this.connectRouter);
  this.deviceControlRouter.use('/:deviceID' + disconnectRoute, this.disconnectRouter);
  this.deviceControlRouter.use('/:deviceID' + actionInvokeRoute, this.actionInvokeRouter);
  this.deviceControlRouter.use('/:deviceID' + getDeviceSpecRoute, this.getDeviceSpecRouter);
  this.deviceControlRouter.use('/:deviceID' + getStateRoute, this.getStateRouter);
  this.deviceControlRouter.use('/:deviceID' + eventSubRoute, this.eventSubRouter);
  this.deviceControlRouter.use('/:deviceID' + eventUnsubRoute, this.eventUnsubRouter);

  this.deviceManager.on('presentation', this.mountDevicePresentationPage.bind(this));

  this.socketServer = new SocketServer(this.server, this.deviceManager);
}

util.inherits(RouteManager, events.EventEmitter);

var ReqHandler = function(req, res) {
  this.req = req;
  this.res = res;
  this.response = function(code, msg) {
    if (msg) {
      this.res.setHeader('Content-Type', 'application/json');
      this.res.status(code).json(msg);
    } else {
      this.res.sendStatus(code);
    }
  }
};

RouteManager.prototype.mountDevicePresentationPage = function(deviceID) {
  this.deviceControlRouter.use('/:deviceID/presentation', this.presentationRouter);

  this.deviceManager.getDeviceRootUrl(deviceID, function(err, deviceUrl) {
    if (!err) {
      this.presentationRouter.use('/', function(req, res) {
        try {
          urlObj = url.parse(url.format(deviceUrl));
        } catch(e) {
          throw new Error('device url malformed');
        }
        var reqUrl = url.parse(req.url);
        var headersCopy = {};
        // create a copy of request headers
        for (attr in req.headers) {
          if (!req.headers.hasOwnProperty(attr)) continue;
          headersCopy[attr] = req.headers[attr];
        }
        urlObj.path = req.url;
        var options = {
          uri: urlObj,
          method:  req.method,
          path:    reqUrl.path,
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
    } else {
      console.warn('cannot get device root url, error: ' + err.message);
    }
  }.bind(this));
};

RouteManager.prototype.installRoutes = function() {
  var _this = this;

  this.loginRouter.route('/').post(function (req, res) {
    // to be filled by production code
  });

  this.discoverRouter.route('/').post(function(req, res) {
    _this.emit('discoverall', new ReqHandler(req, res));
  });

  this.stopDiscoverRouter.route('/').post(function(req, res) {
    _this.emit('stopdiscover', new ReqHandler(req, res));
  });

  this.deviceListRouter.route('/').get(function(req, res) {
    _this.emit('devicelist', new ReqHandler(req, res));
  });

  this.connectRouter.route('/').post(function(req, res) {
    _this.emit('connect', new ReqHandler(req, res));
  });

  this.disconnectRouter.route('/').post(function(req, res) {
    _this.emit('disconnect', new ReqHandler(req, res));
  });

  //TODO: add a per device GET route to get contents in device.states
  this.actionInvokeRouter.route('/').post(function(req, res) {
    _this.emit('actioninvoke', new ReqHandler(req, res));
  });

  this.getDeviceSpecRouter.route('/').get(function(req, res) {
    _this.emit('getdevicespec', new ReqHandler(req, res));
  });

  this.getStateRouter.route('/').get(function(req, res) {
    _this.emit('getstate', new ReqHandler(req, res));
  });

  this.eventSubRouter.route('/').post(function(req, res) {
    _this.emit('eventsubscribe', new ReqHandler(req, res));
  });

  this.eventUnsubRouter.route('/').post(function(req, res) {
    _this.emit('eventunsubscribe', new ReqHandler(req, res));
  });
}

RouteManager.prototype.installHandlers = function() {
  var _this = this;
  this.on('discoverall', function(reqHandler){
    _this.deviceManager.discoverAll(function(err, data) {
      if (!err) {
        reqHandler.response(200, null);
      } else {
        reqHandler.response(500, err.message);
      }
    });
  });

  this.on('stopdiscover', function(reqHandler) {
    _this.deviceManager.stopDiscoverAll(function(err, data) {
      if (!err) {
        reqHandler.response(200, null);
      } else {
        reqHandler.response(500, err.message);
      }
    });
  });

  this.on('devicelist', function(reqHandler) {
    _this.deviceManager.getDiscoveredDeviceList(function(err, data) {
      if (!err) {
        reqHandler.response(200, data);
      } else {
        reqHandler.response(500, err.message);
      }
    });
  });

  this.on('connect', function(reqHandler) {
    var deviceID = reqHandler.req.params.deviceID;
    var user = reqHandler.req.body.username;
    var pass = reqHandler.req.body.password;

    if (user == null && pass == null) {
      user = ''; pass = '';
    } else if (user == null || user === '') {
      reqHandler.response(500, "must provide a username");
      return;
    } else if (pass == null || pass === '') {
      reqHandler.response(500, "must provide a password");
      return;
    }

    _this.deviceManager.connectDevice(deviceID, user, pass, function(err, data) {
      if (!err) {
        reqHandler.response(200, data);
      } else {
        reqHandler.response(500, err.message);
      }
    });
  });

  this.on('disconnect', function(reqHandler) {
    var deviceID = reqHandler.req.params.deviceID;
    var token = reqHandler.req.body.access_token;
    _this.deviceManager.disconnectDevice(deviceID, token, function(err, data) {
      if (!err) {
        reqHandler.response(200, data);
      } else {
        reqHandler.response(500, err.message);
      }
    });
  });

  this.on('actioninvoke', function(reqHandler) {
    var req = reqHandler.req;
    var deviceID = req.params.deviceID;
    var serviceID = req.body.serviceID;
    var actionName = req.body.actionName;
    var args = req.body.argumentList;
    var token = req.body.access_token;
    _this.deviceManager.invokeDeviceAction(deviceID, serviceID, actionName, args, token, function(err, data) {
      if (!err) {
        reqHandler.response(200, data);
      } else {
        reqHandler.response(500, err.message);
      }
    });
  });

  this.on('getdevicespec', function(reqHandler) {
    var deviceID = reqHandler.req.params.deviceID;
    var token = reqHandler.req.body.access_token;
    _this.deviceManager.getDeviceSpec(deviceID, token, function(err, data) {
      if (!err) {
        reqHandler.response(200, data);
      } else {
        reqHandler.response(500, err.message);
      }
    });
  });

  this.on('getstate', function(reqHandler) {
    var deviceID = reqHandler.req.params.deviceID;
    var serviceID = reqHandler.req.body.serviceID;
    var token = reqHandler.req.body.access_token;
    _this.deviceManager.getDeviceState(deviceID, serviceID, token, function(err, data) {
      if (!err) {
        reqHandler.response(200, data);
      } else {
        reqHandler.response(500, err.message);
      }
    });
  });

  this.on('eventsubscribe', function(reqHandler) {
    var deviceID = reqHandler.req.params.deviceID;
    var serviceID = reqHandler.req.body.serviceID;
    var onChange = reqHandler.req.body.onChange;
    var token = reqHandler.req.body.access_token;
    _this.deviceManager.eventSubscribe(this.subscriber, deviceID, serviceID, token, function(err) {
      if (!err) {
        reqHandler.response(200, null);
      } else {
        reqHandler.response(500, err.message);
      }
    });
  });

  this.on('eventunsubscribe', function(reqHandler) {
    var deviceID = reqHandler.req.params.deviceID;
    var serviceID = reqHandler.req.body.serviceID;
    var token = reqHandler.req.body.access_token;
    _this.deviceManager.eventUnsubscribe(this.subscriber, deviceID, serviceID, token, function(err) {
      if (!err) {
        reqHandler.response(200, null);
      } else {
        reqHandler.response(500, err.message);
      }
    });
  });

  // test subscriber
  this.subscriber = new function() {
    this.onChange = true;
    this.onEvent = function(updated, data) {
      console.log(data);
    };
  }

  this.socketServer.installHandlers();
  this.server.listen(appPort);
}


//TODO
function validateDeviceSpec(spec) {

}

function validateClientRequest(req) {

}

function validateServerResponse(res) {

}

module.exports = RouteManager;
