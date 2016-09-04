var events        = require('events');
var util          = require('util');
var http          = require('http');
var express       = require('express');
var url           = require('url');
var bodyParser    = require('body-parser');
var morgan        = require('morgan');
var ipUtil        = require('./ip-util');
var SocketServer  = require('./socket-server');
var CdifInterface = require('./cdif-interface');
var CdifError     = require('./error').CdifError;

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

function RouteManager(mm) {
  this.app = express();

  this.cdifInterface = new CdifInterface(mm);

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

  this.cdifInterface.on('presentation', this.mountDevicePresentationPage.bind(this));

  this.socketServer = new SocketServer(this.server, this.cdifInterface);
}

util.inherits(RouteManager, events.EventEmitter);

var ReqHandler = function(req, res) {
  this.req = req;
  this.res = res;

  this.redirect = function(url) {
    this.res.redirect(url);
  }.bind(this);

  this.callback = function(err, data) {
    this.res.setHeader('Content-Type', 'application/json');
    if (err) {
      this.res.status(500).json({topic: err.topic, message: err.message});
    } else {
      this.res.status(200).json(data);
    }
  }.bind(this);
};

RouteManager.prototype.mountDevicePresentationPage = function(deviceID) {
  this.deviceControlRouter.use('/:deviceID/presentation', this.presentationRouter);

  this.cdifInterface.getDeviceRootUrl(deviceID, function(err, deviceUrl) {
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

//TODO: sanity check to req data
RouteManager.prototype.installRoutes = function() {
  this.loginRouter.route('/').post(function (req, res) {
    // to be filled by production code
  });

  this.oauthCallbackRouter.route('/').get(function (req, res) {
    this.emit('oauthcallback', new ReqHandler(req, res));
  }.bind(this));

  this.discoverRouter.route('/').post(function(req, res) {
    var reqHandler = new ReqHandler(req, res);

    this.cdifInterface.discoverAll(reqHandler.callback);
  }.bind(this));

  this.stopDiscoverRouter.route('/').post(function(req, res) {
    var reqHandler = new ReqHandler(req, res);

    this.cdifInterface.stopDiscoverAll(reqHandler.callback);
  }.bind(this));

  this.deviceListRouter.route('/').get(function(req, res) {
    var reqHandler = new ReqHandler(req, res);

    this.cdifInterface.getDiscoveredDeviceList(reqHandler.callback);
  }.bind(this));

  this.connectRouter.route('/').post(function(req, res) {
    var reqHandler = new ReqHandler(req, res);

    var deviceID = req.params.deviceID;
    var user     = req.body.username;
    var pass     = req.body.password;

    if (user == null && pass == null) {
      user = ''; pass = '';
    } else if (user == null || user === '') {
      return reqHandler.callback(new CdifError('must provide a username'));
    } else if (pass == null || pass === '') {
      return reqHandler.callback(new CdifError('must provide a password'));
    }
    this.cdifInterface.once('authorizeredirect', function(authorize_redirect_url, deviceID) {
      this.once('oauthcallback', function(rh) {
        var params   = rh.req.query;
        //FIXME: there is a random double callback issue here, possibly caused by oauth, keep watching
        this.cdifInterface.setDeviceOAuthAccessToken(deviceID, params, rh.callback);
      }.bind(this));
      reqHandler.redirect(authorize_redirect_url);
    }.bind(this));

    this.cdifInterface.connectDevice(deviceID, user, pass, reqHandler.callback);
  }.bind(this));

  this.disconnectRouter.route('/').post(function(req, res) {
    var reqHandler = new ReqHandler(req, res);

    var deviceID = req.params.deviceID;
    var token    = req.body.device_access_token;

    this.cdifInterface.disconnectDevice(deviceID, token, reqHandler.callback);
  }.bind(this));

  this.actionInvokeRouter.route('/').post(function(req, res) {
    var reqHandler = new ReqHandler(req, res);

    var deviceID   = req.params.deviceID;
    var serviceID  = req.body.serviceID;
    var actionName = req.body.actionName;
    var args       = req.body.argumentList;
    var token      = req.body.device_access_token;

    this.cdifInterface.invokeDeviceAction(deviceID, serviceID, actionName, args, token, reqHandler.callback);
  }.bind(this));

  this.getDeviceSpecRouter.route('/').get(function(req, res) {
    var reqHandler = new ReqHandler(req, res);

    var deviceID = req.params.deviceID;
    var token    = req.body.device_access_token;

    this.cdifInterface.getDeviceSpec(deviceID, token, reqHandler.callback);
  }.bind(this));

  this.getStateRouter.route('/').get(function(req, res) {
    var reqHandler = new ReqHandler(req, res);

    var deviceID  = req.params.deviceID;
    var serviceID = req.body.serviceID;
    var token     = req.body.device_access_token;

    this.cdifInterface.getDeviceState(deviceID, serviceID, token, reqHandler.callback);
  }.bind(this));

  this.eventSubRouter.route('/').post(function(req, res) {
    var reqHandler = new ReqHandler(req, res);

    var deviceID  = req.params.deviceID;
    var serviceID = req.body.serviceID;
    var onChange  = req.body.onChange;
    var token     = req.body.device_access_token;

    this.cdifInterface.eventSubscribe(this.subscriber, deviceID, serviceID, token, reqHandler.callback);
  }.bind(this));

  this.eventUnsubRouter.route('/').post(function(req, res) {
    var reqHandler = new ReqHandler(req, res);

    var deviceID  = req.params.deviceID;
    var serviceID = req.body.serviceID;
    var token     = req.body.device_access_token;

    this.cdifInterface.eventUnsubscribe(this.subscriber, deviceID, serviceID, token, reqHandler.callback);
  }.bind(this));

  this.deviceSchemaRouter.route('/*').get(function(req, res) {
    var reqHandler = new ReqHandler(req, res);

    var deviceID = req.params.deviceID;
    var token    = req.body.device_access_token;
    var path     = req.url;

    this.cdifInterface.getDeviceSchema(deviceID, path, token, reqHandler.callback);
  }.bind(this));

  // test subscriber
  this.subscriber = new function() {
    this.onChange = true;
    this.publish = function(updated, data) {
      console.log(data);
    };
  }

  this.socketServer.installHandlers();
  this.server.listen(ipUtil.getHostPort());
};

module.exports = RouteManager;
