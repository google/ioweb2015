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

IOWA.Elements = (function() {

  "use strict";

  var updateElements = function() {
    var toast = document.getElementById('toast');
    var ioLogo = document.querySelector('io-logo');

    var drawer = document.querySelector('core-drawer-panel');
    drawer.addEventListener('core-activate', function(e) {
      this.closeDrawer();
    });

    var ripple = document.querySelector('.masthead__ripple__content');
    var masthead = document.querySelector('.masthead');
    var i18n = document.createElement('io-i18n');
    i18n.msgid = 'home';

    IOWA.Elements.Drawer = drawer;
    IOWA.Elements.I18n = i18n;
    IOWA.Elements.Masthead = masthead;
    IOWA.Elements.Ripple = ripple;
    IOWA.Elements.Toast = toast;
    IOWA.Elements.IOLogo = ioLogo;

    ioLogo.addEventListener('finish', function() {
      IOWA.Elements.Template.pageTransitioningOut = false;
      IOWA.Elements.Template.pageTransitioningIn = true;
    });
  };

  var init = function() {

    var template = document.getElementById('t');
    template.pages = {};
    template.selectedPage = IOWA.Router.getPageName(window.location.pathname);
    template.pageTransitioningOut = true;
    template.fullscreenVideoActive = false;

    template.pages = {
      'schedule': {
        mastheadBgClass: 'bg-cyan'
      },
      'home': {
        mastheadBgClass: 'bg-medium-grey'
      },
      'about': {
        mastheadBgClass: 'bg-dark-grey'
      },
      'onsite': {
        mastheadBgClass: 'bg-dark-grey'
      },
      'offsite': {
        mastheadBgClass: 'bg-cyan'
      },
      'registration': {
        mastheadBgClass: 'bg-cyan'
      }
    };

    template.toggleOverlayNav = function() {
      var nav = document.querySelector('.navbar--overlay');

      // If overlay bar is down, stop
      if (nav.classList.contains('active')) {
        this.cardVideoTakeover(this.currentCard, true);
      }

      nav.classList.toggle('active');
    };

    /**
     * Material design video animation.
     *
     * @param {Element} card The card element to perform the takeover on.
     * @param {bool} opt_reverse If true, runs the animation in reverse.
     */
    template.cardVideoTakeover = function(card, opt_reverse) {
      if (!card) {
        return;
      }

      var reverse = opt_reverse || false;

      // Forward animation sequence. The reverse sequence is played when reverse == true.
      // 1. Fade out the play button on the card.
      // 2. Transform/scale the video container down to the location and size of the clicked card.
      // 3. Remove 2's transform. This scales up video container to fill the viewport.
      // 4. Drop down the video controls overlay bar.
      // 5. Auto-play the video (on desktop). When it reaches the playing state, fade out the video thumbnail.

      var cardPhoto = card.querySelector('.card__photo');
      var videoContainer = document.querySelector('.fullvideo__container');
      var video = videoContainer.querySelector('.fullvideo__container google-youtube');

      var thumbnail = videoContainer.querySelector('.fullvideo_thumbnail');
      var playButton = card.querySelector('.play__button');

      var cardPhotoMetrics = cardPhoto.getBoundingClientRect();

      var viewportWidth = document.documentElement.clientWidth;
      var viewportHeight = document.documentElement.clientHeight;

      var scaleX = cardPhotoMetrics.width / viewportWidth;
      var scaleY = cardPhotoMetrics.height / viewportHeight;
      var top = cardPhotoMetrics.top + window.scrollY;

      video.pause(); // Pause a running video.

      var playButtonPlayer = playButton.animate([{opacity: 1}, {opacity: 0}], {
        duration: 350,
        iterations: 1,
        fill: 'forwards',
        easing: 'cubic-bezier(0,0,0.21,1)',
        direction: reverse ? 'reverse' : 'normal'
      });

      playButtonPlayer.onfinish = function(e) {

        var startTransform = 'translate(' + cardPhotoMetrics.left + 'px, ' + top + 'px) ' +
                             'scale(' + scaleX + ', ' + scaleY + ')';

        if (!reverse) {
          // Scale down the video container before unhiding it.
          // TODO(ericbidelman): shouldn't have to do this. The initial state
          // is setup in the animate() below.
          videoContainer.style.transform = videoContainer.style.webkitTransform = startTransform;
        } else {
          // Fade in thumbnail before shrinking.
          thumbnail.classList.remove('fadeout');
        }

        // Container is shrunk and in the card's location.
        // Unhide it so thumbnail is visible.
        videoContainer.hidden = false;

        var player = videoContainer.animate([
          {transform: startTransform},
          {transform: 'translate(0, 0) scale(1)'}
        ], {
          duration: 400,
          direction: reverse ? 'reverse' : 'normal',
          iterations: 1,
          fill: 'forwards',
          easing: 'cubic-bezier(0.4,0,0.2,1)'
        });

        player.onfinish = function(e) {
          if (reverse) {
            this.fullscreenVideoActive = false; // remove from DOM.
            this.currentCard = null;
          } else {
            var onStateChange = function(e) {
              if (e.detail.data == 1) { // Playing state is video.state == 1.
                thumbnail.classList.add('fadeout');

                video.removeEventListener('google-youtube-state-change', onStateChange);
              }
            }.bind(this);

            if (video.playsupported) {
              video.play();
              video.addEventListener('google-youtube-state-change', onStateChange);
            } else {
              // If video can't auto-play, fade out thumbnail and toggle navbar.
              thumbnail.classList.add('fadeout');
            }

            this.toggleOverlayNav(); // Drop down back button control.
          }

        }.bind(this);

      }.bind(this);
    };

    template.playVideo = function(e, detail, sender) {
      this.currentCard = sender;
      this.fullscreenVideoActive = true; // Stamp the template's DOM.
    };

    template.videoReady = function(e, detail, sender) {
      this.cardVideoTakeover(this.currentCard);
    };

    template.addEventListener('template-bound', updateElements);

    IOWA.Elements.Template = template;
    IOWA.Elements.ScrollContainer = document.querySelector(
        'core-drawer-panel > div[main]');
  };

  return {
    init: init
  };
})();
