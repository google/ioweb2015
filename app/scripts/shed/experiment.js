(function(global) {
  global.shed.router.get('/experiment/(.+)', global.shed.networkFirst);
})(self);
