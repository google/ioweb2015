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
    registration.onupdatefound = function(event) {
      // updatefound is also fired the very first time the SW is installed, and there's no need to
      // prompt for a reload at that point. So check here to see if the page is already controlled
      // and only display the "Site updates are available..." toast if there is.
      if (navigator.serviceWorker.controller) {
        // TODO: How do we handle i18n of this string?
        var message = 'Site updates are available. ';

        // The SW code calls skipWaiting(), which should bypass the waiting state and allow a
        // refresh (rather than a force-refresh) to pull in the latest content.
        // However, skipWaiting() was added in Chrome 41, so we need to account for the fact that
        // in Chrome 40 a force-refresh will still be required.
        if (registration.installing || registration.waiting) {
          message += 'Please force-refresh.';
        } else {
          message += 'Please refresh.';
        }

        IOWA.Elements.Toast.showMessage(message);
      }
    };
  }).catch(function(e) {
    IOWA.Analytics.trackError('navigator.serviceWorker.register() rejection', e);
    console.error('Service worker registration failed:', e);
  });
}
