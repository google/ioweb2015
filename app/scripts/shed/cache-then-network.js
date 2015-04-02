function serveFromCacheOrNetwork(request) {
  // Never fall back on the SW cache if this is a request that uses auth.
  if (request.headers.has('Authorization')) {
    return shed.networkOnly(request);
  }

  if (request.headers.get('X-Cache-Only') === 'true') {
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
  }

  // If this is a request with either 'X-Cache-Only: false' or just a normal request without
  // it set, then perform a HTTP fetch and cache the result.
  return shed.networkFirst(request);
}

// TODO: /temporary_api/ can be removed once /api/ is available.
shed.router.get('/(.+)temporary_api/(.+)', serveFromCacheOrNetwork);
shed.router.get('/(.+)api/(.+)', serveFromCacheOrNetwork);
