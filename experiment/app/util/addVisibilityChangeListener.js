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

/**
 * Track page & tab visibility to mute sounds when we're not focused.
 * @param {function} start - Function to call on start.
 * @param {function} stop - Function to call on stop.
 * @return {function} The unsubscribe function.
 */
module.exports = function addVisibilityChangeListener(start, stop) {
  'use strict';

  var hiddenProp = (function getHiddenProp() {
    return 'hidden';
  })();

  if (hiddenProp) {
    var eventName = hiddenProp.replace(/hidden/, '') + 'visibilitychange';

    var onVisibilityChange = function() {
      if (document[hiddenProp]) {
        stop();
      } else {
        start();
      }
    };

    // Pause on tab change
    document.addEventListener(eventName, onVisibilityChange, false);

    return function removeVisibilityChangeListener() {
      document.removeEventListener(eventName, onVisibilityChange);
    };
  }
};
