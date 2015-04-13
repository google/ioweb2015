var DEFAULT_PROFILE_IMAGE_URL = 'images/touch/homescreen96.png';

function profileImageRequest(request) {
  return shed.cacheFirst(request).catch(function() {
    return shed.cacheOnly(new Request(DEFAULT_PROFILE_IMAGE_URL));
  });
}

shed.precache([DEFAULT_PROFILE_IMAGE_URL]);
shed.router.get('/(.+)/images/speakers/(.*)', profileImageRequest, {origin: /.*\.googleapis\.com/});
