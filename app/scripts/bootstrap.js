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

(function() {

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js', {
      scope: './'
    }).then(function(registration) {
      // Check to see if there's an updated version of service-worker.js with new files to cache:
      // https://slightlyoff.github.io/ServiceWorker/spec/service_worker/index.html#service-worker-registration-update-method
      // Note: registration.update() is not yet widely implemented.
      if (typeof registration.update == 'function') {
        registration.update();
      }

      registration.onupdatefound = function() {
        // updatefound is also fired the very first time the SW is installed, and there's no need to
        // prompt for a reload at that point. So check here to see if the page is already controlled,
        // i.e. whether there's an existing service worker.
        if (navigator.serviceWorker.controller) {
          // The updatefound event implies that registration.installing is set; see
          // https://slightlyoff.github.io/ServiceWorker/spec/service_worker/index.html#service-worker-container-updatefound-event
          var installingWorker = registration.installing;
          installingWorker.onstatechange = function() {
            // TODO: How do we handle i18n of these strings?
            switch (installingWorker.state) {
              case 'installed':
                // Define a handler that will be used for the next io-toast tap, at which point it
                // be automatically removed.
                var tapHandler = function() {
                  navigator.serviceWorker.getRegistration().then(function(registration) {
                    return registration.unregister();
                  }).then(function() {
                    window.location.reload(true);
                  });
                };

                IOWA.Elements.Toast.showMessage(
                  'Please tap or refresh the page for the latest content.', tapHandler);
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

  function afterImports() {
    IOWA.Elements.init();
    IOWA.Router.init();
  }

  if (IOWA.Util.supportsHTMLImports) {
    afterImports();
  } else {
    document.addEventListener('polymer-ready', afterImports);
  }

})();
