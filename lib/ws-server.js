var events              = require('events');
var util                = require('util');
var url                 = require('url');
var CdifError           = require('./error').CdifError;
var WebSocketServer     = require('ws').Server;
var WSSubscriberManager = require('./ws-subscriber');
var logger              = require('./logger');

function WSServer(server, cdifInterface) {
  this.wss = new WebSocketServer(
    { server: server,
      // TODO: improve security check in production environment
      // See https://github.com/websockets/ws/blob/1242a8ca0de7668fc5fe1ddbfba09d42e95aa7cc/doc/ws.md
      verifyClient: function(info) {
        // console.log(info);
        return true;
      }
    }
  );
  this.cdifInterface     = cdifInterface;
  this.subscriberManager = new WSSubscriberManager();

  this.wss.on('connection', this.onNewConnection.bind(this));
  this.wss.on('error',      this.onServerError.bind(this));
}

WSServer.prototype.getEventSubscriber = function(ws, clientKey, options, callback) {
  this.subscriberManager.getEventSubscriber(ws, clientKey, options, callback);
};

WSServer.prototype.findEventSubscriber = function(ws, clientKey, options, callback) {
  this.subscriberManager.findEventSubscriber(ws, clientKey, options, callback);
};

WSServer.prototype.removeEventSubscriber = function(subscriber, callback) {
  this.subscriberManager.removeEventSubscriber(subscriber, callback);
};

WSServer.prototype.findAllEventSubsribers = function(ws, clientKey, callback) {
  this.subscriberManager.findAllEventSubsribers(ws, clientKey, callback);
};

//TODO: fix callback by using session object
WSServer.prototype.eventSubscribe = function(subscriber, deviceID, serviceID, device_access_token, callback) {
  this.cdifInterface.eventSubscribe(subscriber, deviceID, serviceID, device_access_token, callback);
};

WSServer.prototype.eventUnsubscribe = function(subscriber, deviceID, serviceID, device_access_token, callback) {
  this.cdifInterface.eventUnsubscribe(subscriber, deviceID, serviceID, device_access_token, callback);
};

WSServer.prototype.onNewConnection = function(ws) {
  // TODO: see http://stackoverflow.com/a/16395220/151312 on how to parse cookie in production environment
  // var location = url.parse(ws.upgradeReq.url, true);
  // it seems we have to use client key to uniquely identify a client connection..
  if (ws.upgradeReq.headers['sec-websocket-key'] == null) {
    logger.error('no valid client key');
    return ws.terminate();
  }

  ws.wsServer = this;

  ws.on('open',    this.onSocketOpen.bind(ws));
  ws.on('close',   this.onSocketClose.bind(ws));
  ws.on('message', this.onInputMessage.bind(ws));
  ws.on('error',   this.onSocketError.bind(ws));
  ws.on('ping',    this.onPing.bind(ws));
  ws.on('pong',    this.onPong.bind(ws));
};

WSServer.prototype.onServerError = function(error) {
  logger.error('websocket server error: ' + error);
};

// TODO: better not cache access_token in memory considering multi-user support
// below code belongs to ws instance
WSServer.prototype.onSocketOpen = function() {
};

WSServer.prototype.onSocketClose = function(code, message) {
  var clientKey = this.upgradeReq.headers['sec-websocket-key'];

  this.wsServer.findAllEventSubsribers(this, clientKey, function(err, subscribers) {
    if (subscribers == null) return;

    for (var s in subscribers) {
      var subscriber = subscribers[s];
      var opt = subscriber.options;

      this.wsServer.eventUnsubscribe(subscriber, opt.deviceID, opt.serviceID, opt.device_access_token, function(err) {
        if (err) {
          logger.error(err);
        }
        this.wsServer.removeEventSubscriber(subscriber, function(error, subscriber, options) {
          if (error) {
            logger.error(error);
          }
        }.bind(this));
      }.bind(this));
    }
  }.bind(this));

  this.terminate();
};

// TODO: support event id, subscription renew
WSServer.prototype.onInputMessage = function(message, flags) {
  // assume no need to check mask flag
  if (flags.binary) return;

  var inputMessage = null;

  try {
    inputMessage = JSON.parse(message);
  } catch (e) {
    return this.send(JSON.stringify({topic: 'cdif error', message: 'socket input message not in JSON format'}));
  }

  switch(inputMessage.topic) {
    case 'subscribe':
      var options = inputMessage.options;
      if (options == null) {
        return this.send(JSON.stringify({topic: 'cdif error', message: 'socket subscription options invalid'}));
      }

      var deviceID            = options.deviceID;
      var serviceID           = options.serviceID;
      var device_access_token = options.device_access_token;

      if (deviceID == null || serviceID == null) {
        return this.send(JSON.stringify({topic: 'cdif error', message: 'unknown socket subscription options'}));
      }

      var clientKey = this.upgradeReq.headers['sec-websocket-key'];

      this.wsServer.getEventSubscriber(this, clientKey, options, function(subscriber, created) {
        if (!created) return;

        this.wsServer.eventSubscribe(subscriber, deviceID, serviceID, device_access_token, function(err) {
          if (err) {
            this.send(JSON.stringify({topic: err.topic, message: err.message}));
            this.wsServer.removeEventSubscriber(subscriber, function(){});
          }
        }.bind(this));
      }.bind(this));
      break;
    case 'unsubscribe':
      var options = inputMessage.options;
      if (options == null) {
        return this.send(JSON.stringify({topic: 'cdif error', message: 'socket unsubscription options invalid'}));
      }

      var deviceID            = options.deviceID;
      var serviceID           = options.serviceID;
      var device_access_token = options.device_access_token;

      if (deviceID == null || serviceID == null) {
        return this.send(JSON.stringify({topic: 'cdif error', message: 'unknown socket unsubscription options'}));
      }

      var clientKey = this.upgradeReq.headers['sec-websocket-key'];

      this.wsServer.findEventSubscriber(this, clientKey, options, function(subscriber) {
        if (subscriber === null) {
          return this.send(JSON.stringify({topic: 'cdif error', message: 'cannot find existing event subscription'}));
        }
        var opt = subscriber.options;
        this.wsServer.eventUnsubscribe(subscriber, opt.deviceID, opt.serviceID, opt.device_access_token, function(err) {
          if (err) {
            return this.send(JSON.stringify({topic: 'cdif error', message: err.message}));
          }
          this.wsServer.removeEventSubscriber(subscriber, function(error, subscriber, options) {
            if (error) {
              return this.send(JSON.stringify({topic: 'cdif error', message: error.message}));
            }
          }.bind(this));
        }.bind(this));
      }.bind(this));
      break;
    default:
      return this.send(JSON.stringify({topic: 'cdif error', message: 'unknown socket input message'}));
      break;
  }
};

WSServer.prototype.onSocketError = function(error) {
  logger.error('websocket error: ' + error);
};

WSServer.prototype.onPing = function(data, flags) {

};

WSServer.prototype.onPong = function(data, flags) {

};

module.exports = WSServer;
