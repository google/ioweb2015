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

window.DEV = true; // Remove for prod.

(function(exports) {
  'use strict';

  exports.IOWA = exports.IOWA || {};

  var POLYMER_ANALYTICS_TIMEOUT_ = 60 * 1000;

  // log some polymer startup performance numbers
  function trackPerfAnalyticsEvent(eventName, categoryName) {
    // performance.now() is sadly disabled even in some very recent browsers
    // TODO(bckenny): for now, only do polymer perf analytics in browsers with it.
    if (window.performance && window.performance.now) {
      document.addEventListener(eventName, function() {
        var now = window.performance.now();

        if (exports.DEV) {
          console.info(eventName, '@', now);
        }

        var variable = eventName;
        if (now > POLYMER_ANALYTICS_TIMEOUT_) {
          variable += ' - outliers';
        }

        exports.ga('send', {
          'hitType': 'timing',
          'timingCategory': categoryName,
          'timingVar': variable,
          'timingValue': now,
          //'timingLabel': 'Polymer',
          'page': location.pathname
        });
      });
    }
  }

  trackPerfAnalyticsEvent('template-bound', 'Polymer');
  trackPerfAnalyticsEvent('HTMLImportsLoaded', 'Polymer');
  trackPerfAnalyticsEvent('polymer-ready', 'Polymer');

  // TODO(ericbidelman): add i18n support.
  // if (exports.DEV) {
  //   // Polyfill needs I18nMsg to exist before setting the lang. Timing is fine for native.
  //   // Set locale for entire site (e.g. i18n-msg elements).
  //   document.addEventListener('HTMLImportsLoaded', function() {
  //     I18nMsg.lang = document.documentElement.lang || 'en';
  //   });
  // }

})(window);
