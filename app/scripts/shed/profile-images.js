(function(global) {
  var DEFAULT_PROFILE_IMAGE_URL = 'images/touch/homescreen96.png';

  function profileImageRequest(request) {
    return global.shed.cacheFirst(request).catch(function() {
      return global.shed.cacheOnly(new Request(DEFAULT_PROFILE_IMAGE_URL));
    });
  }

  global.shed.precache([DEFAULT_PROFILE_IMAGE_URL]);
  global.shed.router.get('/(.+)/images/speakers/(.*)', profileImageRequest, {origin: /.*\.googleapis\.com/});
})(self);
