(function(global) {
  global.shed.router.get('/(.+)', global.shed.cacheFirst, {origin: /https?:\/\/fonts.+/});
})(self);
