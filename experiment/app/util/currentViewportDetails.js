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

module.exports = (function() {
  'use strict';

  /**
   * Get the current scroll of the "window". If we're inside the I/O
   * site, then we need to check a specific container elements.
   */
  return function currentViewportDetails() {
    if (('undefined' !== typeof IOWA) &&
        ('undefined' !== typeof IOWA.Elements) &&
        ('undefined' !== typeof IOWA.Elements.ScrollContainer)) {
      return {
        scrollElement: IOWA.Elements.ScrollContainer,
        x: IOWA.Elements.ScrollContainer.scrollLeft,
        y: IOWA.Elements.ScrollContainer.scrollTop,
        height: IOWA.Elements.ScrollContainer.scrollHeight
      };
    } else {
      return {
        scrollElement: window,
        x: window.scrollX,
        y: window.scrollY,
        height: document.body.getBoundingClientRect().height
      };
    }
  };
})();
