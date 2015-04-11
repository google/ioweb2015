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

IOWA.Elements = (function() {
  "use strict";

  function showSigninHelp() {
    var signinIntroEl = document.querySelector('.card__signin-intro');
    var showSigninIntro = !JSON.parse(localStorage.getItem('showSigninIntro'));
    if (showSigninIntro) {
      signinIntroEl.addEventListener('core-overlay-close-completed', function(e) {
        e.stopPropagation();
        localStorage.setItem('showSigninIntro', JSON.stringify(true));

        signinIntroEl.parentElement.removeChild(signinIntroEl);
        signinIntroEl = null;
      });

      signinIntroEl.opened = true;
    } else {
      signinIntroEl.parentElement.removeChild(signinIntroEl);
    }
  }

  function optionallyLaunchExperiment() {
    if (window.location.search.indexOf('experiment') > -1) {
      IOWA.Elements.FAB.onFabClick();
    }
  }

  function updateElements() {
    var ioLogo = document.querySelector('io-logo');
    ioLogo.addEventListener('io-logo-animation-done', function(e) {
      // Loading auth is delayed until logo animation is done.
      IOWA.Elements.GoogleSignIn.load = true;

      // Deep link into a subpage.
      var tpl = IOWA.Elements.Template;
      var defaultSubpage = tpl.pages[tpl.selectedPage].selectedSubpage;
      var selectedSubpage = location.hash.substring(1) || defaultSubpage;
      var subpage = document.querySelector('#subpage-' + selectedSubpage);
      if (subpage) {
        tpl.pages[tpl.selectedPage].selectedSubpage = selectedSubpage;
        subpage.classList.add('active');
      }

      IOWA.PageAnimation.play(
        IOWA.PageAnimation.pageFirstRender(subpage), function() {
          // Fire event when the page transitions are final.
          IOWA.Elements.Template.fire('page-transition-done');
          optionallyLaunchExperiment();
          IOWA.ServiceWorkerRegistration.register();

          showSigninHelp(); // show signin help popup on page load.
        }
      );
    });

    var ioLive = document.querySelector('io-live');
    if (ioLive) {
      var onLiveMode_ = function(e) {
        if (e.detail.mode === 'live') {
          var els = [IOWA.Elements.Masthead, IOWA.Elements.NavPaperTabs,
                     IOWA.Elements.Masthead.querySelector('#signin-nav-elements')];
          els.forEach(function(el) {
            el.classList.remove('bg-cyan');
            el.classList.add('bg-photo');
          });

          ioLive.removeEventListener('io-live-mode', onLiveMode_);
        }
      };

      ioLive.addEventListener('io-live-mode', onLiveMode_);
    }

    var main = document.querySelector('.io-main');

    var drawer = document.querySelector('core-drawer-panel');
    drawer.addEventListener('core-activate', function(e) {
      this.closeDrawer();
    });

    var masthead = document.querySelector('.masthead');
    var mastheadMeta = masthead.querySelector('.masthead-meta');
    var mastheadMetaCorner = masthead.querySelector('.masthead-meta--corner');
    var nav = masthead.querySelector('#navbar');
    var navPaperTabs = nav.querySelector('paper-tabs');
    var drawerMenu = document.getElementById('drawer-menu');
    var fab = masthead.querySelector('#fab');
    var footer = document.querySelector('footer');
    var toast = document.getElementById('toast');
    var liveStatus = document.getElementById('live-status');
    var signin = document.querySelector('google-signin');

    var ripple = masthead.querySelector('.masthead__ripple__content');
    IOWA.Util.resizeRipple(ripple);

    IOWA.Elements.Drawer = drawer;
    IOWA.Elements.Masthead = masthead;
    IOWA.Elements.MastheadMeta = mastheadMeta;
    IOWA.Elements.MastheadMetaCorner = mastheadMetaCorner;
    IOWA.Elements.Main = main;
    IOWA.Elements.Nav = nav;
    IOWA.Elements.DrawerMenu = drawerMenu;
    IOWA.Elements.NavPaperTabs = navPaperTabs;
    IOWA.Elements.Ripple = ripple;
    IOWA.Elements.FAB = fab;
    IOWA.Elements.Toast = toast;
    IOWA.Elements.LiveStatus = liveStatus;
    IOWA.Elements.Footer = footer;
    IOWA.Elements.GoogleSignIn = signin;

    // Kickoff a11y helpers for elements
    IOWA.A11y.init();
  }

  function init() {
    var template = document.getElementById('t');
    template.pages = IOWA.PAGES; // defined in auto-generated ../pages.js
    template.selectedPage = IOWA.Router.getPageName(window.location.pathname);
    template.fullscreenVideoActive = false;
    template.mastheadVideoActive = false;
    template.photoGalleryActive = false;
    template.extendedMapActive = false;
    template.pageTransitionDone = false;
    template.offsiteGlobeVisible = false;
    template.homeGlobeVisible = false;
    template.selectedCity = null;
    template.offsiteMarkerResults = [];
    template.countdownEnded = false;

    // Sign-in defaults.
    template.isSignedIn = false;
    template.currentUser = null;

    // Videos page defaults.
    template.videoList = [];
    template.filteredVideoList = [];

    template.rippleColors = {
      'bg-cyan': '#00BCD4',
      'bg-medium-grey': '#CFD8DC',
      'bg-dark-grey': '#455A64',
      'bg-photo': '#455A64'
    };

    template.mastheadBgClass = template.pages[template.selectedPage].mastheadBgClass;
    template.navBgClass = template.mastheadBgClass;

    template.filterThemes = [
      'Develop & Design',
      'Engage & Earn',
      "What's Next"
    ];

    template.filterTopics = [
      'All',
      'Accessibility',
      'Android',
      'Audience Growth',
      'Auto',
      'Chrome / Web',
      'Polymer',
      'Design',
      'Earn',
      'Games',
      'Google Play',
      'Location',
      'Search',
      'Tools & APIs',
      'TV & Living Room',
      'Wearables'
    ];

    template.filterSessionTypes = [
      'Sessions',
      'Sandbox Talks',
      'Workshops',
      'Office Hours',
      'Code Labs'
    ];

    template.formatSessionTimeFilter = function(dateStr) {
      var date = new Date(dateStr);
      return date.toLocaleTimeString().replace(/:\d+ /, ' ');
    };

    template.formatSessionDateFilter = function(dateStr) {
      var date = new Date(dateStr);
      var day = date.getDate();
      var month = date.getMonth() + 1;
      if (month === 5) {
        return 'May ' + day;
      } else if (month === 6) {
        return 'June ' + day;
      }
      return day;
    };

    template.formatSessionTagsFilter = function(tagList) {
      if (!tagList) {
        return;
      }
      var list = tagList.map(function(tag) {
        return this.scheduleData.tags[tag].name;
      }, this);
      return list.join(', ');
    };

    template.scrollLock = function(enable) {
      document.body.classList.toggle('noscroll', enable);
    };

    template.toggleVideoOverlayNav = function() {
      var nav = document.querySelector('.navbar__overlay--video');
      nav.classList.toggle('active');
    };

    template.closeVideoCard = function(e, detail, sender) {
      this.cardVideoTakeover(this.currentCard, true);
      this.toggleVideoOverlayNav();
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
            thumbnail.classList.add('fadeout');
            this.toggleVideoOverlayNav(); // Drop down back button control.
          }
        }.bind(this);
      }.bind(this);
    };

    template.playVideo = function(e, detail, sender) {
      this.currentCard = sender;
      this.fullscreenVideoActive = true; // Active the placeholder template.

      IOWA.Analytics.trackEvent('link', 'click', sender.getAttribute('data-track-link'));

      // Wait one rAF for template to have stamped.
      this.async(function() {
        this.cardVideoTakeover(this.currentCard);
      });
    };

    template.openVideo = function(e, detail, sender) {
      this.currentCard = sender;
      this.fullscreenVideoActive = true; // Active the placeholder template.

      IOWA.Analytics.trackEvent('video', 'watch', sender.getAttribute('data-videoid'));

      // Wait one rAF for template to have stamped.
      this.async(function() {
        var videoContainer = document.querySelector('.fullvideo__container');
        var video = videoContainer.querySelector('google-youtube');

        video.addEventListener('google-youtube-ready', function(e) {
          video.videoid = sender.getAttribute('data-videoid'); // IE10 doesn't support .dataset.
          this.cardVideoTakeover(this.currentCard);
        }.bind(this));

        var thumbnail = videoContainer.querySelector('.fullvideo_thumbnail');
        thumbnail.src = sender.getAttribute('data-videoimg'); // IE10 doesn't support .dataset.
      });
    };

    template.openShareWindow = function(e, detail, sender) {
      e.preventDefault();

      var type = sender.getAttribute('data-share-type');
      var width = 600;
      var height = 600;

      var url = null;
      switch (type) {
        case 'fb':
          height = 229;
          url = 'https://www.facebook.com/sharer.php?u=' +
                encodeURIComponent(location.href) +
                '&t=' + encodeURIComponent(document.title);
          break;

        case 'gplus':
          height = 348;
          width = 512;
          url = 'https://plus.google.com/share?url=' +
                encodeURIComponent(location.href) +
                '&hl=' + encodeURIComponent(document.documentElement.lang);
          break;

        case 'twitter':
          height = 253;
          var el = document.getElementById('share-text');

          url = 'https://twitter.com/intent/tweet?text=' +
                encodeURIComponent(el.textContent || 'Google I/O 2015');
          break;

        default:

          return;
      }

      var options = 'menubar=no,toolbar=no,resizable=yes,scrollbars=yes,height=' +
                    height + ',width=' + width;
      window.open(url, 'share', options);
    };

    template.backToTop = function(e, detail, sender) {
      e.preventDefault();
      IOWA.Util.smoothScroll(IOWA.Elements.Nav, 250);
      IOWA.A11y.focusNavigation();
    };

    template.onCountdownTimerThreshold = function(e, detail, sender) {
      if (detail.label === 'Ended') {
        this.countdownEnded = true;
      }
    };

    template.signIn = function() {
      IOWA.Elements.GoogleSignIn.signIn();
    };

    template.signOut = function() {
      IOWA.Elements.GoogleSignIn.signOut();
    };

    template.updateNotifyUser = function(e, detail, sender) {
      // Both these functions are asynchronous and return promises. Since there's no specific
      // callback or follow-up that needs to be performed once they complete, the returned promise
      // is ignored.
      if (sender.checked) {
        // subscribePromise() handles registering a subscription with the browser's push manager
        // and toggling the notify state to true in the backend via an API call.
        IOWA.Notifications.subscribePromise();
      } else {
        // The steps to turn off notifications are broken down into two separate promises, the first
        // which unsubscribes from the browser's push manager and the second which sets the notify
        // state to false in the backend via an API call.
        // Note that we are deliberately not clearing the SW token stored in IDB, since that is tied
        // to the user's logged in state and will remain valid if notifications are re-enabled
        // later on.
        IOWA.Notifications.unsubscribeFromPushManagerPromise()
          .then(disableNotificationsPromise)
          .catch(IOWA.Util.reportError);
      }
    };

    template.addEventListener('template-bound', updateElements);
    template.addEventListener('page-transition-done', function(e) {
      this.pageTransitionDone = true;
      IOWA.Elements.NavPaperTabs.style.pointerEvents = '';
    });
    template.addEventListener('page-transition-start', function(e) {
      this.pageTransitionDone = false;
      IOWA.Elements.NavPaperTabs.style.pointerEvents = 'none';
    });

    IOWA.Elements.Template = template;
    IOWA.Elements.ScrollContainer = document.querySelector(
        'core-drawer-panel [main]');
    template.ScrollContainer = IOWA.Elements.ScrollContainer;
  }

  return {
    init: init
  };
})();
