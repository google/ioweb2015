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

CDS.Masthead = (function() {

  "use strict";

  var RANGE = 30;
  var masthead = document.querySelector('.masthead');
  var mastheadColorBlock = masthead.querySelector('.masthead__color-block');
  var y;

  function onScroll() {

    y = CDS.Util.getWindowScrollPosition();

    if (y < 0)
      return;

    mastheadColorBlock.style.opacity = Math.min(1, Math.max(0, y / RANGE));
  }

  CDS.EventPublisher.add('scroll', onScroll);

})();
