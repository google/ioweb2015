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
  }

  if (request.headers.get('X-Cache-Only') == 'false') {
    return shed.networkFirst(request);
  }

  return fetch(request);
}

// TODO: /temporary_api/ can be removed once /api/ is available.
shed.router.get('/(.+)temporary_api/(.+)', serveFromCacheOrNetwork);
shed.router.get('/(.+)api/(.+)', serveFromCacheOrNetwork);
