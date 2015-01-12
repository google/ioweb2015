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

IOWA.Router.init();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js', {
    scope: './'
  }).then(function(registration) {
    registration.onupdatefound = function() {
      // updatefound is also fired the very first time the SW is installed, and there's no need to
      // prompt for a reload at that point. So check here to see if the page is already controlled,
      // i.e. whether there's an existing service worker.
      if (navigator.serviceWorker.controller) {
        // The updatefound event implies that registration.installing is set; see
        // https://slightlyoff.github.io/ServiceWorker/spec/service_worker/index.html#service-worker-container-updatefound-event
        var installingWorker = registration.installing;

        // The SW code calls skipWaiting(), which should bypass the waiting state and allow a
        // refresh (rather than a force-refresh) to pull in the latest content.
        // However, skipWaiting() was added in Chrome 41, so we need to account for the fact that
        // in Chrome 40 a force-refresh will still be required.
        // To do this, we detect the state change from installing:
        //   -> installed (a force refresh is required)
        //   -> activated (a normal refresh/navigation is required)
        //   -> redundant (something went wrong; log an error)
        installingWorker.onstatechange = function() {
          // Define a handler that will be used for the next io-toast tap, at which point it will
          // be automatically removed.
          var tapHandler = function() {
            navigator.serviceWorker.getRegistration().then(function(registration) {
              return registration.unregister();
            }).then(function() {
              window.location.reload(true);
            });
          };

          // TODO: How do we handle i18n of these strings?
          switch (installingWorker.state) {
            case 'installed':
              IOWA.Elements.Toast.tapHandler = tapHandler;
              IOWA.Elements.Toast.showMessage('Please tap or force-refresh for the latest content.');
            break;

            case 'activated':
              IOWA.Elements.Toast.tapHandler = tapHandler;
              IOWA.Elements.Toast.showMessage('Please tap or refresh for the latest content.');
            break;

            case 'redundant':
              throw 'The installing service worker became redundant.';
          }
        };
      }
    };
  }).catch(function(e) {
    IOWA.Analytics.trackError('navigator.serviceWorker.register() error', e);
    console.error('Service worker registration failed:', e);
  });
}
