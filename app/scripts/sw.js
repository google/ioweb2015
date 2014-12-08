/**
 * Copyright 2014 Google Inc. All rights reserved.
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

importScripts('scripts/third_party/serviceworker-cache-polyfill.js');

var CACHE_NAME = 'chrome-dev-summit';
var CACHE_VERSION = 42;

self.oninstall = function(event) {

  event.waitUntil(
    caches.open(CACHE_NAME + '-v' + CACHE_VERSION).then(function(cache) {

      return cache.addAll([

        '/devsummit/',
        '/devsummit/schedule/',
        '/devsummit/sessions/',
        '/devsummit/attendee-information/',
        '/devsummit/get-involved/',
        '/devsummit/about-chrome-dev-summit/',

        '/devsummit/styles/cds.min.css',
        '/devsummit/scripts/cds.min.js',
        '/devsummit/images/chrome-icon.jpg',
        '/devsummit/images/chrome-icon@2x.jpg',
        '/devsummit/images/icon-camera.svg',
        '/devsummit/images/masthead-1.jpg',
        '/devsummit/images/masthead-1@2x.jpg',
        '/devsummit/images/masthead-2.jpg',
        '/devsummit/images/masthead-2@2x.jpg',
        '/devsummit/images/masthead-3.jpg',
        '/devsummit/images/masthead-3@2x.jpg',
        '/devsummit/images/masthead-4.jpg',
        '/devsummit/images/masthead-4@2x.jpg',
        '/devsummit/images/icon-back-arrow.svg',
        '/devsummit/images/icon-schedule.svg',
        '/devsummit/images/icon-schedule-gray.svg',
        '/devsummit/images/icon-sessions.svg',
        '/devsummit/images/icon-quad.svg',
        '/devsummit/images/icon-get-involved.svg',
        '/devsummit/images/pic-1.jpg',
        '/devsummit/images/pic-1@2x.jpg',
        '/devsummit/images/pic-2.jpg',
        '/devsummit/images/pic-2@2x.jpg',
        '/devsummit/images/pic-3.jpg',
        '/devsummit/images/pic-3@2x.jpg',

        '/devsummit/images/sessions/keynote.jpg',
        '/devsummit/images/sessions/keynote@2x.jpg',
        '/devsummit/images/sessions/wicked-fast.jpg',
        '/devsummit/images/sessions/wicked-fast@2x.jpg',
        '/devsummit/images/sessions/asking-for-super-powers-chromes-permission-model.jpg',
        '/devsummit/images/sessions/asking-for-super-powers-chromes-permission-model@2x.jpg',
        '/devsummit/images/sessions/material-design-deconstructed.jpg',
        '/devsummit/images/sessions/material-design-deconstructed@2x.jpg',
        '/devsummit/images/sessions/the-applied-science-of-runtime-performance.jpg',
        '/devsummit/images/sessions/the-applied-science-of-runtime-performance@2x.jpg',
        '/devsummit/images/sessions/making-web-apps-appy.jpg',
        '/devsummit/images/sessions/making-web-apps-appy@2x.jpg',
        '/devsummit/images/sessions/tls-all-the-things-security-with-performance.jpg',
        '/devsummit/images/sessions/tls-all-the-things-security-with-performance@2x.jpg',
        '/devsummit/images/sessions/easy-composition-and-reuse.jpg',
        '/devsummit/images/sessions/easy-composition-and-reuse@2x.jpg',
        '/devsummit/images/sessions/polymer-state-of-the-union.jpg',
        '/devsummit/images/sessions/polymer-state-of-the-union@2x.jpg',
        '/devsummit/images/sessions/lets-build-some-apps-with-polymer.jpg',
        '/devsummit/images/sessions/lets-build-some-apps-with-polymer@2x.jpg',
        '/devsummit/images/sessions/fundamentals-of-mobile-web-development.jpg',
        '/devsummit/images/sessions/fundamentals-of-mobile-web-development@2x.jpg',
        '/devsummit/images/sessions/closing-keynote.jpg',
        '/devsummit/images/sessions/closing-keynote@2x.jpg',
        '/devsummit/images/sessions/panel.png',
        '/devsummit/images/sessions/panel@2x.png',

        '/devsummit/images/chrome-touch-icon-192x192.png'

      ]);
    })
  );
};

self.onactivate = function(event) {

  var currentCacheName = CACHE_NAME + '-v' + CACHE_VERSION;
  caches.keys().then(function(cacheNames) {
    return Promise.all(
      cacheNames.map(function(cacheName) {
        if (cacheName.indexOf(CACHE_NAME) == -1) {
          return;
        }

        if (cacheName != currentCacheName) {
          return caches.delete(cacheName);
        }
      })
    );
  });

};

self.onfetch = function(event) {

  event.respondWith(

    // Check the cache for a hit.
    caches.match(request).then(function(response) {

      // If we have a response return it.
      if (response)
        return response;

      // Otherwise fetch it, store and respond.
      return fetch(request).then(function(response) {

        var responseToCache = response.clone();

        caches.open(CACHE_NAME + '-v' + CACHE_VERSION).then(
          function(cache) {
            cache.put(request, responseToCache).catch(function(err) {
              // Likely we got an opaque response which the polyfill
              // can't deal with, so log out a warning.
              console.warn(requestURL + ': ' + err.message);
            });
          });

        return response;
      });

    })
  );
};
