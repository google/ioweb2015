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

window.IOWA = window.IOWA || {};

IOWA.A11y = IOWA.A11y || (function() {

  "use strict";

  function init() {
    // Differentiate focus coming from mouse and keyboard
    addFocusStates('paper-tabs a');
  }

  // Elements passed to this method will receive classes reflecting the focus
  // and pressed states.
  function addFocusStates(selector) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), function(el) {
      el.addEventListener('mousedown', function(e) {
        this.classList.add('pressed');
      });

      el.addEventListener('mouseup', function(e) {
        this.classList.remove('pressed');
      });

      el.addEventListener('focus', function(e) {
        // Only render the "focused" state if the element gains focus due to
        // keyboard navigation.
        if (!this.classList.contains('pressed')) {
          this.classList.add('focused');
        }
      });

      el.addEventListener('blur', function(e) {
        this.classList.remove('focused');
      });
    });
  }

  // Shortcut to set the focus to the first item in the navigation menu
  function focusNavigation() {
    IOWA.Elements.NavPaperTabs.items[0].firstElementChild.focus();
  }

  return {
    init: init,
    addFocusStates: addFocusStates,
    focusNavigation: focusNavigation
  };

})();
