var bunyan = require('bunyan');

//TODO: configurable error log path, per component (child) logging
module.exports = {
  createLogger: function() {
    this.logger = bunyan.createLogger({
      name: 'cdif',
      serializers: bunyan.stdSerializers,
      streams: [
        {
          level: 'info',
          stream: process.stdout
        },
        {
          level:  'error',
          type:   'file',
          path:   __dirname + '/../cdif-error.log'
        }
      ]
    });
  },
  info: function(logInfo) {
    this.logger.info(logInfo);
  },
  error: function(errorInfo) {
    this.logger.error(errorInfo);
  }
};
