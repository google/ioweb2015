(function(global) {
  // Requests whose URLs contain this string contain user-specific data in their corresponding
  // Responses, and should be cleared when the user logs out.
  var USER_DATA_URL_SUBSTRING = 'api/v1/user/';

  function serveFromCacheOrNetwork(request) {
    // Never fall back on the SW cache if this is a request that uses auth, unless it's a request
    // that has the X-Cache-Only header set.
    if (request.headers.has('Authorization') && !request.headers.has('X-Cache-Only')) {
      return global.shed.networkOnly(request);
    }

    if (request.headers.get('X-Cache-Only') === 'true') {
      return global.shed.cacheOnly(request).then(function(response) {
        if (response) {
          return response;
        } else {
          return new Response('', {
            status: 204,
            statusText: 'No cached content available.'
          });
        }
      });
    }

    // If this is a request with either 'X-Cache-Only: false' or just a normal request without
    // it set, then perform a HTTP fetch and cache the result.
    return global.shed.networkFirst(request);
  }

  // temporary_api is useful for testing against static content.
  global.shed.router.get('/(.+)temporary_api/(.+)', serveFromCacheOrNetwork);
  global.shed.router.get('/(.+)api/(.+)', serveFromCacheOrNetwork);

  global.addEventListener('message', function(event) {
    if (event.data === 'clear-cached-user-data') {
      global.caches.open(global.shed.options.cacheName).then(function(cache) {
        cache.keys().then(function(requests) {
          return requests.filter(function(request) {
            return request.url.indexOf(USER_DATA_URL_SUBSTRING) !== -1;
          });
        }).then(function(userDataRequests) {
          userDataRequests.forEach(function(userDataRequest) {
            cache.delete(userDataRequest);
          });
        });
      });
    }
  });
})(self);
