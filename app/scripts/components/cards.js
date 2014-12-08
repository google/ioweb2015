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

CDS.Cards = (function() {

  "use strict";

  var cardElements = document.querySelectorAll('.card');
  var card;
  var cards = {};
  var cardId = '';

  function onCardChange() {

    CDS.VideoEmbedder.killAllEmbeddedVideos();

    if (!CDS.Cards[window.location.pathname]) {
      CDS.Theme.set('#362A6C');
      return;
    }

    var currentCard = CDS.Cards[window.location.pathname];
    CDS.Theme.set(currentCard.getContentColor());
  }

  for (var i = 0; i < cardElements.length; i++) {
    card = cardElements[i];
    cardId = card.querySelector('.card__see-more').getAttribute('href');
    cards[cardId] = new CDS.Card(card);
    cards[cardId].addEventListener('expand', onCardChange);
    cards[cardId].addEventListener('collapse', onCardChange);
  }

  return cards;

})();
