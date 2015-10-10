var events = require('events');
var util = require('util');
var express = require('express');
var bodyParser = require('body-parser');
var morgan = require('morgan');

//TODO: check port availability
var appPort = 3049;

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

function RouteManager(deviceManager) {
  this.app = express();
  this.deviceManager = deviceManager;
  this.discoverRouter = express.Router();
  this.stopDiscoverRouter = express.Router();
  this.deviceListRouter = express.Router();
  this.deviceControlRouter = express.Router();
  this.connectRouter = express.Router({mergeParams: true});
  this.disconnectRouter = express.Router({mergeParams: true});
  this.actionInvokeRouter = express.Router({mergeParams: true});
  this.getDeviceSpecRouter = express.Router({mergeParams: true});
  this.eventSubRouter = express.Router({mergeParams: true});
  this.eventUnsubRouter = express.Router({mergeParams: true});

  this.app.use(morgan('dev'));
  this.app.use(bodyParser.json());
  // global routes
  this.app.use(discoverRoute, this.discoverRouter);
  this.app.use(stopDiscoverRoute, this.stopDiscoverRouter);
  this.app.use(deviceListRoute, this.deviceListRouter);
  this.app.use(deviceControlRoute, this.deviceControlRouter);
  //per device routes
  this.deviceControlRouter.use('/:deviceID' + connectRoute, this.connectRouter);
  this.deviceControlRouter.use('/:deviceID' + disconnectRoute, this.disconnectRouter);
  this.deviceControlRouter.use('/:deviceID' + actionInvokeRoute, this.actionInvokeRouter);
  this.deviceControlRouter.use('/:deviceID' + getDeviceSpecRoute, this.getDeviceSpecRouter);
  this.deviceControlRouter.use('/:deviceID' + eventSubRoute, this.eventSubRouter);
  this.deviceControlRouter.use('/:deviceID' + eventUnsubRoute, this.eventUnsubRouter);
}

util.inherits(RouteManager, events.EventEmitter);

var ReqHandler = function(req, res) {
  this.req = req;
  this.res = res;
  this.response = function(code, msg) {
    if (msg) {
      this.res.status(code).send(JSON.stringify(msg));
    } else {
      this.res.sendStatus(code);
    }
  }
};

RouteManager.prototype.installRoutes = function() {
  var _this = this;
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

  //TODO: all get* request should take GET method, so framework no need to call device api each time, instead return framework's cached device states to client
  // after doing this, framework would query device *only* if a state table entry is empty, this can happen on framework startup or device reboot and when a state variable doesn't have defaultValue
  // and after doing this, there is no need to validate output schema, just validate the return values from a device get call can successfully update an entry in framework's state table
  //TODO: check output schema (output object should contain elements with their valid argument names and what returned to client should have retval property)

  this.actionInvokeRouter.route('/').post(function(req, res) {
    _this.emit('actioninvoke', new ReqHandler(req, res));
  });

  this.getDeviceSpecRouter.route('/').get(function(req, res) {
    _this.emit('getdevicespec', new ReqHandler(req, res));
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
    _this.deviceManager.connectDevice(deviceID, function(err, data) {
      if (!err) {
        reqHandler.response(200, data);
      } else {
        reqHandler.response(500, err.message);
      }
    });
  });

  this.on('disconnect', function(reqHandler) {
    var deviceID = reqHandler.req.params.deviceID;
    _this.deviceManager.disconnectDevice(deviceID, function(err, data) {
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
    var serviceId = req.body.serviceId;
    var actionName = req.body.actionName;
    var args = req.body.argumentList;
    _this.deviceManager.invokeDeviceAction(deviceID, serviceId, actionName, args, function(err, data) {
      if (!err) {
        reqHandler.response(200, data);
      } else {
        reqHandler.response(500, err.message);
      }
    });
  });

  this.on('getdevicespec', function(reqHandler) {
    var deviceID = reqHandler.req.params.deviceID;
    _this.deviceManager.getDeviceSpec(deviceID, function(err, data) {
      if (!err) {
        reqHandler.response(200, data);
      } else {
        reqHandler.response(500, err.message);
      }
    });
  });

  this.on('eventsubscribe', function(reqHandler) {
    var deviceID = reqHandler.req.params.deviceID;
    var serviceId = reqHandler.req.body.serviceId;
    _this.deviceManager.eventSubscribe(deviceID, serviceId, function(err) {
      if (!err) {
        reqHandler.response(200, null);
      } else {
        reqHandler.response(500, err.message);
      }
    });
  });

  this.on('eventunsubscribe', function(reqHandler) {
    var deviceID = reqHandler.req.params.deviceID;
    var serviceId = reqHandler.req.body.serviceId;
    _this.deviceManager.eventUnsubscribe(deviceID, serviceId, function(err) {
      if (!err) {
        reqHandler.response(200, null);
      } else {
        reqHandler.response(500, err.message);
      }
    });
  });
  this.app.listen(appPort);
}

//TODO
function validateDeviceSpec(spec) {

}

function validateClientRequest(req) {

}

function validateServerResponse(res) {

}

module.exports = RouteManager;
