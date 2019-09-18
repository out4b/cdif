var logger = require('logger');

module.exports = {
  setOptions: function(argv) {
    this.isDebug       = (argv.debug         === true) ? true : false;
    this.allowDiscover = (argv.allowDiscover === true) ? true : false;
    this.heapDump      = (argv.heapDump      === true) ? true : false;
    this.wsServer      = (argv.wsServer      === true) ? true : false;
    this.sioServer     = (argv.sioServer     === true) ? true : false;

    this.localDBAccess = true; // whether or not access local device DB
    this.dbPath        = null; // the absolute path of local device DB

    if (argv.dbPath != null && typeof(argv.dbPath) === 'string') {
      this.dbPath = argv.dbPath;
    }

    this.localModulePath = null;

    //TODO: support specify only one module name now
    if (argv.loadModule != null) {
      this.localDBAccess = false;
      this.localModulePath = argv.loadModule;
    }

    if (this.wsServer === true && this.sioServer === true) {
      logger.info('trying to start WebSocket and SocketIO server simultanenouesly, start with WebSocket server');
    }
  }
};
