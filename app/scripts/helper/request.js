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

self.IOWA = self.IOWA || {};

IOWA.Request = IOWA.Request || (function() {

  "use strict";

  /**
   * Helper method to populate the Authorization header of an XMLHttpRequest.
   * The XMLHttpRequest is modified in-place, and nothing is returned.
   * @param {XMLHttpRequest} xhr The XMLHttpRequest to modify.
   * @param {object} authInfo The value returned by IOWA.Auth.getTokenResponse()
   */
  function setXhrAuthHeader_(xhr, authInfo) {
    if (authInfo) {
      xhr.setRequestHeader('Authorization', authInfo.token_type + ' ' + authInfo.access_token);
    }
  }

  // Inspired by http://jakearchibald.com/2014/offline-cookbook/#cache-then-network
  var cacheThenNetwork = function(url, cachedContentCallback, freshContentCallback, opt_isAuthRequired) {
    var authInfo;
    if (opt_isAuthRequired) {
      authInfo = IOWA.Auth.getTokenResponse();
      if (!authInfo) {
        // If we require auth but aren't logged in, then call freshContentCallback() without any
        // response body and bail out.
        freshContentCallback();
        return;
      }
    }

    var freshContentPending = true;
    var cachedResponse;

    // Only bother sending the request for cached content if we're running in a user agent
    // that supports service workers and the page is currently controlled by one.
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      var cachedXhr = new XMLHttpRequest();
      cachedXhr.open('GET', url);
      setXhrAuthHeader_(cachedXhr, authInfo);
      cachedXhr.setRequestHeader('X-Cache-Only', 'true');

      cachedXhr.onload = function() {
        // Check to make sure that the fresh content hasn't already been returned to the page
        // (we don't want to overwrite it). This normally wouldn't happen, since reading from the
        // cache should be faster, but better safe than sorry.
        // Also check to make sure there's actually content returned, since the SW code will return
        // a HTTP 204 with an empty body if the request wasn't found in the cache.
        if (this.status < 400 && freshContentPending && this.response) {
          cachedResponse = this.response;
          cachedContentCallback(JSON.parse(cachedResponse));
        }
      };

      cachedXhr.send();
    }

    var freshXhr = new XMLHttpRequest();
    freshXhr.open('GET', url);
    setXhrAuthHeader_(freshXhr, authInfo);
    freshXhr.setRequestHeader('X-Cache-Only', 'false');

    freshXhr.onload = function() {
      if (this.status < 400 && this.response != cachedResponse) {
        // Indicate that we've received the fresh content, just in case the request for cached
        // content is still pending.
        freshContentPending = false;
        freshContentCallback(JSON.parse(this.response));
      }
    };

    freshXhr.send();
  };

  /**
   * XMLHttpRequest wrapper that returns a promise and supports our authorization scheme.
   * @param {string} method The HTTP method.
   * @param {string} url The HTTP request URL.
   * @param {boolean} isAuthRequired Whether to include an Authorization header.
   * @param {object} body Optional HTTP request body.
   * @return {Promise} Resolves with response body, or rejects with an error on HTTP failure.
   */
  var xhrPromise = function(method, url, isAuthRequired, body) {
    return new Promise(function(resolve, reject) {
      var authInfo;
      if (isAuthRequired) {
        authInfo = IOWA.Auth.getTokenResponse();
        if (!authInfo) {
          throw Error(method + ' ' + url + ' failed; not logged in.');
        }
      }

      var xhr = new XMLHttpRequest();
      xhr.open(method, url);
      xhr.setRequestHeader('Content-Type', 'application/json');
      setXhrAuthHeader_(xhr, authInfo);

      xhr.onerror = reject;
      xhr.onload = function() {
        if (this.status < 400) {
          var response = {};
          try {
            response = JSON.parse(this.response);
          } catch (e) {
            // Noop
          }
          resolve(response);
        } else {
          reject(Error(method + ' ' + url + ' failed with status ' + this.statusText));
        }
      };

      xhr.send(body ? JSON.stringify(body) : null);
    });
  };

  return {
    cacheThenNetwork: cacheThenNetwork,
    xhrPromise: xhrPromise
  };
})();
