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

 /**
  * @fileOverview The ajax-based routing for IOWA subpages.
  */

IOWA.Router = (function() {

  "use strict";

  var MASTHEAD_BG_CLASS_REGEX = /(\s|^)bg-[a-z-]+(\s|$)/;

  /**
   * Tells what kind of transition is currently happening on the page,
   * e.g. 'hero-card-transition' or 'masthead-ripple-transition'.
   * @type {=string?}
   */
  var currentPageTransition = null;

  /**
   * True if the URL update was due to a user click. Used to differentiate a
   * popstate event from a link click and a history pop.
   * @type {boolean}
   */
  var navigationFromLinkClick = false;

  /**
   * Navigates to a new page via a hero card takeover transition.
   * @param {Event} e Event that triggered navigation.
   * @param {Element} el Element clicked.
   * @param {string} rippleColor Color of the ripple on the card.
   * @private
   */
  function playHeroTransition(e, el, rippleColor) {
    // TODO: This may need some perf tweaking for FF.
    var card = null;
    var currentEl = el;
    while (!card) {
      currentEl = currentEl.parentNode;
      if (currentEl.classList.contains('card__container')) {
        card = currentEl;
      }
    }
    IOWA.PageAnimation.play(
      IOWA.PageAnimation.pageCardTakeoverOut(
          card, e.pageX, e.pageY, 300, rippleColor),
      function() {
        IOWA.History.pushState({'path': el.pathname}, '', el.href);
      }
    );
  }

  /**
   * Navigates to a new page via a masthead nav item ripple transition.
   * @param {Event} e Event that triggered navigation.
   * @param {Element} el Element clicked.
   * @param {string} rippleColor Color of the ripple on the card.
   * @param {boolean} isFadeRipple If true, ripple will just glimpse and fade.
   * @private
   */
  function playMastheadRippleTransition(e, el, rippleColor, isFadeRipple) {
    var callback;
    var rippleAnim = IOWA.PageAnimation.ripple(
          IOWA.Elements.Ripple, e.pageX, e.pageY, 400,
          rippleColor, isFadeRipple);
    var animation = new AnimationGroup([
      rippleAnim,
      IOWA.PageAnimation.contentSlideOut()
    ]);
    IOWA.PageAnimation.play(animation, function() {
      IOWA.History.pushState({'path': el.pathname}, '', el.href);
    });
  }

  /**
   * Navigates to a new page via ajax and page transitions.
   * @param {Event} e Event that triggered navigation.
   * @param {Element} el Element clicked.
   * @private
   */
  function handleAjaxLink(e, el) {
    e.preventDefault();
    e.stopPropagation();

    var template = IOWA.Elements.Template;

    // We can get the full absolute path from the <a> element's pathname:
    // http://stackoverflow.com/questions/736513
    var pageName = parsePageNameFromAbsolutePath(el.pathname);
    template.nextPage = pageName;

    var page = template.selectedPage;
    var bgClass = template.pages[pageName] &&
                  template.pages[pageName].mastheadBgClass;

    template.navBgClass = bgClass;
    var isFadeRipple = template.pages[page].mastheadBgClass === bgClass;
    var rippleColor = isFadeRipple ? '#fff' : template.rippleColors[bgClass];

    if (page !== pageName) {
      IOWA.Elements.Template.fire('page-transition-start');
      if (el.hasAttribute('data-anim-ripple')) {
        currentPageTransition = 'masthead-ripple-transition';
        playMastheadRippleTransition(e, el, rippleColor, isFadeRipple);
      } else if (el.hasAttribute('data-anim-card'))  {
        currentPageTransition = 'hero-card-transition';
        playHeroTransition(e, el, rippleColor);
      } else {
        currentPageTransition = '';
        IOWA.History.pushState({'path': el.pathname}, '', el.href);
      }
    }
    // TODO: Update meta.
  }

  /**
   * Navigates to a new page. Uses ajax for data-ajax-link links.
   * @param {Event} e Event that triggered navigation.
   * @private
   */
  function navigate(e) {
    // Allow user to open page in a new tab.
    if (e.metaKey || e.ctrlKey) {
      return;
    }

    navigationFromLinkClick = true;

    // Inject page if <a> has the data-ajax-link attribute.
    for (var i = 0; i < e.path.length; ++i) {
      var el = e.path[i];
      if (el.localName === 'a') {
        var currentPage = IOWA.Elements.Template.selectedPage;
        var nextPage = parsePageNameFromAbsolutePath(el.pathname);

        // Prevent navigations to the same page.
        // Note, this prevents in-page anchors. Use IOWA.Util.smoothScroll.
        if (currentPage === nextPage) {
          e.preventDefault();
          return;
        }

        // Record click event if link requests it.
        if (el.hasAttribute('data-track-link')) {
          IOWA.Analytics.trackEvent(
              'link', 'click', el.getAttribute('data-track-link'));
        }

        // Do ajax page navigation if link requests it.
        if (el.hasAttribute('data-ajax-link')) {
          runPageHandler('unload', currentPage);
          handleAjaxLink(e, el);
        } else {
          currentPageTransition = 'no-transition';
        }

        return; // found first navigation element, quit here.
      }
    }
  }

  /**
   * Renders a new page by fetching partials through ajax.
   * @param {string} pageName The name of the new page.
   * @private
   */
  function renderPage(pageName) {
    var importURL = pageName + '?partial';
    Polymer.import([importURL], function() {
      // Don't proceed if import didn't load correctly.
      var htmlImport = document.querySelector(
          'link[rel="import"][href="' + importURL + '"]');
      if (htmlImport && !htmlImport.import) {
        return;
      }
      // Update content of the page.
      injectPageContent(pageName, htmlImport.import);
    });
  }

  /**
   * Replaces templated content.
   * @private
   */
  function replaceTemplateContent(currentPageTemplates) {
    for (var j = 0; j < currentPageTemplates.length; j++) {
      var template = currentPageTemplates[j];
      var templateToReplace = document.getElementById(
          template.getAttribute('data-ajax-target-template'));
      if (templateToReplace) {
        templateToReplace.setAttribute('ref', template.id);
      }
    }
  }

  /**
   * Updates the page elements during the page transition.
   * @param {string} pageName New page identifier.
   * @param {NodeList} currentPageTemplates Content templates to be rendered.
   * @private
   */
  function updatePageElements(pageName, currentPageTemplates, mastheadBgClass) {
    replaceTemplateContent(currentPageTemplates);
    document.body.id = 'page-' + pageName;

    var template = IOWA.Elements.Template;
    template.selectedPage = pageName;
    document.title = (template.pages[pageName].title || 'Google I/O 2015');

    // Prepare the page for a smooth masthead transition.
    template.navBgClass = mastheadBgClass;
    // This cannot be updated via data binding, because the masthead
    // is visible before the binding happens.
    IOWA.Elements.Masthead.className = IOWA.Elements.Masthead.className.replace(
        MASTHEAD_BG_CLASS_REGEX, ' ' + mastheadBgClass + ' ');

    // Hide the masthead ripple before proceeding with page transition.
    IOWA.PageAnimation.play(
      IOWA.PageAnimation.elementFadeOut(IOWA.Elements.Ripple, {duration: 0}));

    // Scroll to top of new page.
    IOWA.Elements.ScrollContainer.scrollTop = 0;

    setTimeout(function() {
      if (currentPageTransition === 'hero-card-transition') {
        IOWA.PageAnimation.play(IOWA.PageAnimation.pageCardTakeoverIn(), function() {
          IOWA.Elements.Template.fire('page-transition-done');
        });
      } else {
        IOWA.PageAnimation.play(IOWA.PageAnimation.pageSlideIn(), function() {
          // Fire event when the page transitions are final.
          IOWA.Elements.Template.fire('page-transition-done');
        });
      }
      currentPageTransition = '';
    }, 100); // Wait for the... Good question. Maybe template binding?
    // TODO: BUG: Anyways, something to investigate. Web Animations
    // are not working properly without this delay (Chrome crashes).
  }

  /**
   * Runs animated page transition.
   * @param {string} pageName New page identifier.
   * @private
   */
  function animatePageIn(pageName) {
    // Prequery for content templates.
    var currentPageTemplates = document.querySelectorAll(
        '.js-ajax-' + pageName);
    var bgClass = IOWA.Elements.Template.pages[pageName].mastheadBgClass;
    if (!currentPageTransition) {
      var animation = IOWA.PageAnimation.contentSlideOut();
      IOWA.PageAnimation.play(animation, updatePageElements.bind(
          null, pageName, currentPageTemplates, bgClass));
    } else if (currentPageTransition !== 'no-transition') {
      updatePageElements(pageName, currentPageTemplates, bgClass);
    }
  }

  /**
   * Parses the page name out of the last entry in absolutePath, split on '/'.
   * Defaults to 'home' if absolutePath ends in '/' or is ''.
   * @private
   */
  function parsePageNameFromAbsolutePath(absolutePath) {
    return absolutePath.split('/').pop() || 'home';
  }

  /**
   * Renders a new page for the current location.
   * @private
   */
  function renderCurrentPage() {
    renderPage(parsePageNameFromAbsolutePath(window.location.pathname));
  }

  /**
   * Injects new page content into existing layout.
   * @param {string} pageName New page identifier.
   * @param {DocumentFragment} importContent HTML containing templates to be
   *    injected.
   * @private
   */
  function injectPageContent(pageName, importContent) {

    runPageHandler('load', pageName);

    // Add freshly fetched templates to DOM, if not yet present.
    var newTemplates = importContent.querySelectorAll('.js-ajax-template');
    for (var i = 0; i < newTemplates.length; i++) {
      var newTemplate = newTemplates[i];
      if (!document.getElementById(newTemplate.id)) {
        document.body.appendChild(newTemplate);
      }
    }
    animatePageIn(pageName);
  }

  function runPageHandler(funcName, pageName) {
    var page = IOWA.Elements.Template.pages[pageName];
    if (page && page[funcName]) {
      // If page we're going to has a load handler, run it.
      page[funcName]();
    }
  }

  /**
   * Initialized ajax-based routing on the page.
   */
  function init() {
    window.addEventListener('popstate', function(e) {
      var currentPage = IOWA.Elements.Template.selectedPage;
      var nextPage = parsePageNameFromAbsolutePath(window.location.pathname);

      // Note: popstate is fired when history.pushState() is called so we need
      // to determine if the event was organic (browser back/forward button).
      // If it was, currentPage has not been updated yet and is the previous page.
      if (!navigationFromLinkClick) {
        runPageHandler('unload', currentPage);
      }

      navigationFromLinkClick = false; // Reset

      // Ignore the navigation if it was a hash update, but on the same page.
      if (e.state && e.state.fromHashChange && nextPage === currentPage) {
        return;
      }

      renderCurrentPage();
    });

    document.addEventListener('click', navigate);
  }

  return {
    init: init,
    getPageName: parsePageNameFromAbsolutePath,
    animatePageIn: animatePageIn
  };

})();
