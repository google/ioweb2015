(function(global) {
  global.shed.router.get('/js/api.js', global.shed.networkFirst, {origin: 'https://apis.google.com'});
})(self);
