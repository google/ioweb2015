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
    // Differentiate focus coming from mouse and keyboard.
    addFocusStates('.io-logo-link');
    addFocusStates('#navbar paper-tabs a');
    document.addEventListener('toast-message', announceLiveChange);
  }

  // Handlers managed by the addFocusStates and removeFocusStates methods.
  var onMouseDown = function(e) {
    this.classList.add('pressed');
    // this hackery is required for paper-slider which prevents
    // default on mousedown so dragging doesn't select text on screen
    // without a proper mousedown, focus does not move off of the slider
    // if you click on another slider
    this.focus();
  };

  var onMouseUp = function(e) {
    this.classList.remove('pressed');
  };

  var onFocus = function(e) {
    // Only render the "focused" state if the element gains focus due to
    // keyboard navigation.
    if (!this.classList.contains('pressed')) {
      this.classList.add('focused');
    }
  };

  var onBlur = function(e) {
    this.classList.remove('focused');
  };

  // Elements passed to this method will receive classes reflecting the focus
  // and pressed states.
  function addFocusStates(selector) {
    var nodes = document.querySelectorAll(selector);
    Array.prototype.forEach.call(nodes, function(el) {
      el.addEventListener('mousedown', onMouseDown);
      el.addEventListener('mouseup', onMouseUp);
      el.addEventListener('focus', onFocus);
      el.addEventListener('blur', onBlur);
    });
  }
  // Cleanup method for elements with managed focus states
  function removeFocusStates(selector) {
    var nodes = document.querySelectorAll(selector);
    Array.prototype.forEach.call(nodes, function(el) {
      el.removeEventListener('mousedown', onMouseDown);
      el.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('focus', onFocus);
      el.removeEventListener('blur', onBlur);
    });
  }

  // Shortcut to set the focus to the first item in the navigation menu
  function focusNavigation() {
    IOWA.Elements.NavPaperTabs.items[0].firstElementChild.focus();
  }

  // Pipe text to an aria-live region. This is automatically trigged
  // when toasts are shown.
  function announceLiveChange(e) {
    // Annoying timeout hack to work around https://code.google.com/p/chromium/issues/detail?id=469254
    setTimeout(function() {
      IOWA.Elements.LiveStatus.textContent = 'Notification: ' + e.detail.message;
    }, 1000);
  }

  return {
    init: init,
    addFocusStates: addFocusStates,
    removeFocusStates: removeFocusStates,
    focusNavigation: focusNavigation,
    announceLiveChange: announceLiveChange
  };

})();
