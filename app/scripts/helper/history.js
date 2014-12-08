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

CDS.History = (function() {

  "use strict";

  var activePath;
  var transitioningCard = null;

  function manageCards(opt_disableAnimation) {

    var currentPath = document.location.pathname;
    var compositePath = '/';

    if (typeof opt_disableAnimation !== 'boolean')
      opt_disableAnimation = false;

    if (activePath === currentPath)
      return;

    if (transitioningCard)
      return;

    // If the new card is not a child of the current section collapse it
    // before opening the new card.
    if (currentPath.indexOf(activePath) === -1 &&
      typeof CDS.Cards[activePath] !== 'undefined') {

      transitioningCard = CDS.Cards[activePath];
      transitioningCard.collapse();

    } else if (typeof CDS.Cards[currentPath] !== 'undefined') {

      // Step up through the path making sure any other cards are enabled
      currentPath.split('/').forEach(function(part) {

        if (part === '')
          return;

        compositePath += part + '/';

        if (compositePath !== currentPath &&
            typeof CDS.Cards[compositePath] !== 'undefined') {

          CDS.Cards[compositePath].expand(true);

        } else if (compositePath === currentPath) {

          transitioningCard = CDS.Cards[currentPath];
          transitioningCard.expand(opt_disableAnimation);
        }
      });
    }

    if (transitioningCard !== null) {
      transitioningCard.addEventListener('transitionend',
          onTransitionEnd.bind(transitioningCard), true);
    }

    activePath = currentPath;
  }

  function onPopState(evt) {
    evt.preventDefault();
    requestAnimFrame(manageCards);
  }

  function onTransitionEnd() {
    transitioningCard = null;
    requestAnimFrame(manageCards);
  }

  function forth(path) {
    window.history.pushState(null, "", path);
    requestAnimFrame(manageCards);
  }

  function back() {
    window.history.back();
  }

  function init() {
    manageCards(true);
    transitioningCard = null;
  }

  function onKeyUp(evt) {

    // We only care about the user hitting escape
    // to collapse the card down.
    if (evt.keyCode !== 27)
      return;

    if (typeof CDS.Cards[activePath] !== 'undefined')
      forth('../');

  }

  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('popstate', onPopState);

  return {
    back: back,
    forth: forth,
    init: init
  };

})();
