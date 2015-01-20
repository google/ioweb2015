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

window.IOWA = window.IOWA || {};

IOWA.Util = IOWA.Util || (function() {

  "use strict";

  function getWindowScrollPosition() {
    if (typeof window.scrollY === 'undefined') {
      return document.documentElement.scrollTop;
    } else {
      return window.scrollY;
    }
  }

  function isIOS() {
    return (/(iPhone|iPad|iPod)/gi).test(navigator.platform);
  }

  function isSafari() {
    var userAgent = navigator.userAgent;
    return (/Safari/gi).test(userAgent) &&
      !(/Chrome/gi).test(userAgent);
  }

  function isIE() {
    var userAgent = navigator.userAgent;
    return (/Trident/gi).test(userAgent);
  }

  /**
   * Returns the static base URL of the running app.
   * https://events.google.com/io2015/about -> https://events.google.com/io2015/
   */
  function getStaticBaseURL() {
    return location.href.substring(0, location.href.lastIndexOf('/') + 1);
  }

  return {
    isIE: isIE,
    isIOS: isIOS,
    isSafari: isSafari,
    getWindowScrollPosition: getWindowScrollPosition,
    getStaticBaseURL: getStaticBaseURL
  };

})();
