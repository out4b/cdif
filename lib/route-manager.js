var events       = require('events');
var util         = require('util');
var http         = require('http');
var express      = require('express');
var url          = require('url');
var bodyParser   = require('body-parser');
var morgan       = require('morgan');
var ipUtil       = require('./ip-util');
var SocketServer = require('./socket-server');
var CdifError    = require('./error').CdifError;

var loginRoute         = '/login';
var discoverRoute      = '/discover';
var stopDiscoverRoute  = '/stop-discover';
var deviceListRoute    = '/device-list';
var deviceControlRoute = '/device-control';
var connectRoute       = '/connect';
var disconnectRoute    = '/disconnect';
var actionInvokeRoute  = '/invoke-action';
var eventSubRoute      = '/event-sub';
var eventUnsubRoute    = '/event-unsub';
var getDeviceSpecRoute = '/get-spec';
var getStateRoute      = '/get-state';
var deviceSchemaRoute  = '/schema';
var oauthCallbackUrl   = '/callback_url';

function RouteManager(deviceManager) {
  this.app = express();

  this.deviceManager       = deviceManager;
  this.loginRouter         = express.Router();
  this.oauthCallbackRouter = express.Router();
  this.discoverRouter      = express.Router();
  this.stopDiscoverRouter  = express.Router();
  this.deviceListRouter    = express.Router();
  this.deviceControlRouter = express.Router();
  this.connectRouter       = express.Router({mergeParams: true});
  this.disconnectRouter    = express.Router({mergeParams: true});
  this.actionInvokeRouter  = express.Router({mergeParams: true});
  this.getDeviceSpecRouter = express.Router({mergeParams: true});
  this.getStateRouter      = express.Router({mergeParams: true});
  this.eventSubRouter      = express.Router({mergeParams: true});
  this.eventUnsubRouter    = express.Router({mergeParams: true});
  this.presentationRouter  = express.Router({mergeParams: true});
  this.deviceSchemaRouter  = express.Router({mergeParams: true});


  this.server = http.createServer(this.app);

  this.app.use(morgan('dev'));
  this.app.use(bodyParser.json());

  this.app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
  });

  // global routes
  this.app.use(loginRoute,         this.loginRouter);
  this.app.use(oauthCallbackUrl,   this.oauthCallbackRouter);
  this.app.use(discoverRoute,      this.discoverRouter);
  this.app.use(stopDiscoverRoute,  this.stopDiscoverRouter);
  this.app.use(deviceListRoute,    this.deviceListRouter);
  this.app.use(deviceControlRoute, this.deviceControlRouter);
  //per device routes
  this.deviceControlRouter.use('/:deviceID' + connectRoute,       this.connectRouter);
  this.deviceControlRouter.use('/:deviceID' + disconnectRoute,    this.disconnectRouter);
  this.deviceControlRouter.use('/:deviceID' + actionInvokeRoute,  this.actionInvokeRouter);
  this.deviceControlRouter.use('/:deviceID' + getDeviceSpecRoute, this.getDeviceSpecRouter);
  this.deviceControlRouter.use('/:deviceID' + getStateRoute,      this.getStateRouter);
  this.deviceControlRouter.use('/:deviceID' + eventSubRoute,      this.eventSubRouter);
  this.deviceControlRouter.use('/:deviceID' + eventUnsubRoute,    this.eventUnsubRouter);
  this.deviceControlRouter.use('/:deviceID' + deviceSchemaRoute,  this.deviceSchemaRouter);

  this.deviceManager.on('presentation', this.mountDevicePresentationPage.bind(this));

  this.socketServer = new SocketServer(this.server, this.deviceManager);
}

util.inherits(RouteManager, events.EventEmitter);

var ReqHandler = function(req, res) {
  this.req = req;
  this.res = res;
  this.response = function(err, data) {
    if (err) {
      this.res.setHeader('Content-Type', 'application/json');
      this.res.status(500).json({topic: err.topic, message: err.message});
    } else {
      this.res.setHeader('Content-Type', 'application/json');
      this.res.status(200).json(data);
      // if (!data) {
      //   this.res.sendStatus(200);
      // } else {
      //   this.res.status(200).json(data);
      // }
    }
  };
  this.redirect = function(url) {
    this.res.redirect(url);
  };
};

RouteManager.prototype.mountDevicePresentationPage = function(deviceID) {
  this.deviceControlRouter.use('/:deviceID/presentation', this.presentationRouter);

  this.deviceManager.getDeviceRootUrl(deviceID, function(err, deviceUrl) {
    if (!err) {
      this.presentationRouter.use('/', function(req, res) {
        var redirectedUrl = deviceUrl + req.url;
        res.redirect(redirectedUrl);
      });
    } else {
      console.error('cannot get device root url, error: ' + err.message);
    }
  }.bind(this));
};

RouteManager.prototype.installRoutes = function() {
  var _this = this;

  this.loginRouter.route('/').post(function (req, res) {
    // to be filled by production code
  });

  this.oauthCallbackRouter.route('/').get(function (req, res) {
    _this.emit('oauthcallback', new ReqHandler(req, res));
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

  this.deviceSchemaRouter.route('/*').get(function(req, res) {
    _this.emit('getdeviceschema', new ReqHandler(req, res));
  });
};

//TODO: sanity check to req data
RouteManager.prototype.installHandlers = function() {
  this.on('discoverall', function(reqHandler) {
    this.deviceManager.discoverAll(function(err) {
        reqHandler.response(err);
    });
  }.bind(this));

  this.on('stopdiscover', function(reqHandler) {
    this.deviceManager.stopDiscoverAll(function(err) {
      reqHandler.response(err);
    });
  }.bind(this));

  this.on('devicelist', function(reqHandler) {
    this.deviceManager.getDiscoveredDeviceList(function(err, data) {
      reqHandler.response(err, data);
    });
  }.bind(this));

  this.on('connect', function(reqHandler) {
    var deviceID = reqHandler.req.params.deviceID;
    var user = reqHandler.req.body.username;
    var pass = reqHandler.req.body.password;

    if (user == null && pass == null) {
      user = ''; pass = '';
    } else if (user == null || user === '') {
      return reqHandler.response(new CdifError('must provide a username'));
    } else if (pass == null || pass === '') {
      return reqHandler.response(new CdifError('must provide a password'));
    }
    this.deviceManager.once('authorizeredirect', function(authorize_redirect_url, deviceID) {

      this.once('oauthcallback', function(reqHandler) {
        var params   = reqHandler.req.query;

        this.deviceManager.setDeviceOAuthAccessToken(deviceID, params, function(err) {
          //FIXME: there is a random double callback issue here, possibly caused by oauth, keep watching
          //TODO: render something than just sending an OK
          reqHandler.response(err);
        });
      }.bind(this));
      reqHandler.redirect(authorize_redirect_url);
    }.bind(this));

    this.deviceManager.connectDevice(deviceID, user, pass, function(err, data) {
      reqHandler.response(err, data);
    });
  }.bind(this));

  this.on('disconnect', function(reqHandler) {
    var deviceID = reqHandler.req.params.deviceID;
    var token = reqHandler.req.body.device_access_token;
    this.deviceManager.disconnectDevice(deviceID, token, function(err) {
      reqHandler.response(err);
    });
  }.bind(this));

  this.on('actioninvoke', function(reqHandler) {
    var req = reqHandler.req;
    var deviceID = req.params.deviceID;
    var serviceID = req.body.serviceID;
    var actionName = req.body.actionName;
    var args = req.body.argumentList;
    var token = req.body.device_access_token;
    this.deviceManager.invokeDeviceAction(deviceID, serviceID, actionName, args, token, function(err, data) {
      reqHandler.response(err, data);
    });
  }.bind(this));

  this.on('getdevicespec', function(reqHandler) {
    var deviceID = reqHandler.req.params.deviceID;
    var token = reqHandler.req.body.device_access_token;
    this.deviceManager.getDeviceSpec(deviceID, token, function(err, data) {
      reqHandler.response(err, data);
    });
  }.bind(this));

  this.on('getstate', function(reqHandler) {
    var deviceID = reqHandler.req.params.deviceID;
    var serviceID = reqHandler.req.body.serviceID;
    var token = reqHandler.req.body.device_access_token;
    this.deviceManager.getDeviceState(deviceID, serviceID, token, function(err, data) {
      reqHandler.response(err, data);
    });
  }.bind(this));

  this.on('eventsubscribe', function(reqHandler) {
    var deviceID = reqHandler.req.params.deviceID;
    var serviceID = reqHandler.req.body.serviceID;
    var onChange = reqHandler.req.body.onChange;
    var token = reqHandler.req.body.device_access_token;
    this.deviceManager.eventSubscribe(this.subscriber, deviceID, serviceID, token, function(err) {
      reqHandler.response(err);
    });
  }.bind(this));

  this.on('eventunsubscribe', function(reqHandler) {
    var deviceID = reqHandler.req.params.deviceID;
    var serviceID = reqHandler.req.body.serviceID;
    var token = reqHandler.req.body.device_access_token;
    this.deviceManager.eventUnsubscribe(this.subscriber, deviceID, serviceID, token, function(err) {
      reqHandler.response(err);
    });
  }.bind(this));

  // test subscriber
  this.subscriber = new function() {
    this.onChange = true;
    this.publish = function(updated, data) {
      console.log(data);
    };
  }

  this.on('getdeviceschema', function(reqHandler) {
    var deviceID = reqHandler.req.params.deviceID;
    var token    = reqHandler.req.body.device_access_token;
    var path     = reqHandler.req.url;

    this.deviceManager.getDeviceSchema(deviceID, path, token, function(err, data) {
      reqHandler.response(err, data);
    });
  }.bind(this));

  this.socketServer.installHandlers();
  this.server.listen(ipUtil.getHostPort());
};

module.exports = RouteManager;
