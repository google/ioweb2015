function serveFromCacheOrNetwork(request) {
  if (request.headers.get('X-Cache-Only') == 'true') {
    return shed.cacheOnly(request).then(function(response) {
      if (response) {
        return response;
      } else {
        return new Response('', {
          status: 204,
          statusText: 'No cached content available.'
        });
      }
    });
  } else {
    // If this is a request with either 'X-Cache-Only: false' or just a normal request without
    // it set, then perform a HTTP fetch and cache the result.
    return shed.networkFirst(request);
  }
}

// TODO: /temporary_api/ can be removed once /api/ is available.
shed.router.get('/(.+)temporary_api/(.+)', serveFromCacheOrNetwork);
shed.router.get('/(.+)api/(.+)', serveFromCacheOrNetwork);
