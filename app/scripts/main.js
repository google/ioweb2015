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

(function(exports) {
  'use strict';

  exports.IOWA = exports.IOWA || {};

  // TODO(ericbidelman): add i18n support.
  // if (exports.ENV == 'dev') {
  //   // Polyfill needs I18nMsg to exist before setting the lang. Timing is fine for native.
  //   // Set locale for entire site (e.g. i18n-msg elements).
  //   document.addEventListener('HTMLImportsLoaded', function() {
  //     I18nMsg.lang = document.documentElement.lang || 'en';
  //   });
  // }

  // exports.addEventListener('page-transition-done', function(e) {
  //   // TODO
  // })

  exports.addEventListener('resize', function() {
    IOWA.Util.resizeRipple(IOWA.Elements.Ripple);
  });

})(window);
