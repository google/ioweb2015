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

CDS.Util = (function() {

  "use strict";
  var appElement = document.querySelector('.app');

  function makeObject(keys, defaultValue) {

    var obj = {};
    for (var i = 0; i < keys.length; i++) {
      obj[keys[i]] = defaultValue;
    }

    return obj;
  }

  function getWindowScrollPosition() {
    if (typeof window.scrollY === 'undefined')
      return document.documentElement.scrollTop;
    else
      return window.scrollY;
  }

  function isIOS() {
    return (/(iPhone|iPad|iPod)/gi).test(navigator.platform);
  }

  function isSafari() {
    var userAgent = navigator.userAgent;
    return (/Safari/gi).test(userAgent) &&
      !(/Chrome/gi).test(userAgent);
  }

  function canRunFastClipAnimations() {
    // Right now the only answer to this is Chrome,
    // but in future I'm hopeful we can expand this.
    var userAgent = navigator.userAgent;
    return (/Chrome/gi).test(userAgent);
  }

  function isIE() {
    var userAgent = navigator.userAgent;
    return (/Trident/gi).test(userAgent);
  }

  return {
    appElement: appElement,
    isIE: isIE,
    isIOS: isIOS,
    isSafari: isSafari,
    canRunFastClipAnimations: canRunFastClipAnimations,
    makeObject: makeObject,
    getWindowScrollPosition: getWindowScrollPosition
  };

})();
