/**
 * Copyright 2015 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
