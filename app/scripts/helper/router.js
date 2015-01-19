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

 /**
  * @fileOverview The ajax-based routing for IOWA subpages.
  */

IOWA.Router = (function() {

  "use strict";

  var MASTHEAD_BG_CLASS_REGEX = /(\s|^)bg-[a-z-]+(\s|$)/;

  function canRunFastRipple() {
    // Right now the only answer to this is Chrome,
    // but in future I'm hopeful we can expand this.
    var userAgent = navigator.userAgent;
    return (/Chrome/gi).test(userAgent);
  }

  /**
   * Animates a ripple effect over the masthead.
   * @param {Number} x X coordinate of the center of the ripple.
   * @param {Number} y Y coordinate of the center of the ripple.
   * @param {string?} color Optional color for the ripple effect.
   * @private
   */
  function playRipple(ripple, x, y, color, callback) {

    

    var duration = '0.5s';

    ripple.style.backgroundColor = 'red';
    ripple.style.webkitTransition = '';
    ripple.style.transition = '';

    var translate = ['translate3d(', x, 'px,', y, 'px, 0)',].join('');
    ripple.style.webkitTransform = [translate, ' scale(0.3)'].join('');
    ripple.style.transform = [translate, ' scale(0.3)'].join('');
    ripple.style.opacity = color ? 0.5 : 1;
    // Force recalculate style.
    /*jshint -W030 */
    ripple.offsetTop;


    //debugger;
    /*jshint +W030 */
    
   
    if (color) {
      ripple.style.webkitTransition = '-webkit-transform ' + duration + ', opacity ' + duration + '';
      ripple.style.transition = 'transform ' + duration + ', opacity 0.5s';
      ripple.style.backgroundColor = color;
      ripple.style.opacity = 0;
    } else {
      ripple.style.backgroundColor = '';
      ripple.style.webkitTransition = '-webkit-transform ' + duration + '';
      ripple.style.transition = 'transform ' + duration + '';
    }
    ripple.style.webkitTransform = [translate, ' scale(1)'].join('');
    ripple.style.transform = [translate, ' scale(1)'].join('');
    

    //setTimeout(callback, 600) //Wait for the ripple to finish.
      // TODO: give a smaller delay if chrome.

    
  }

  /**
   * Animates a ripple effect over the masthead.
   * @param {Number} x X coordinate of the center of the ripple.
   * @param {Number} y Y coordinate of the center of the ripple.
   * @param {string?} color Optional color for the ripple effect.
   * @private
   */
  function playMastheadRipple(x, y, color, callback) {
    playRipple(IOWA.Elements.Ripple, x, y, color, callback); 
  }

  
  /**
   * Navigates to a new page. Uses ajax for data-ajax-link links.
   * @param {Event} e Event that triggered navigation.
   * @private
   */
  function playCardTransition(el, x, y) {
    var card = null;
    var currentEl = el;
    while (!card) {
      currentEl = currentEl.parentNode;
      if (currentEl.classList.contains('card__container')) {
        card = currentEl;
      }
    }
    var ripple = card.querySelector('.ripple__content');
    
    var rippleRect = ripple.getBoundingClientRect();

    console.log(rippleRect)

    var radius = Math.floor(Math.sqrt(rippleRect.width*rippleRect.width + 
      rippleRect.height*rippleRect.height));

    ripple.style.width = 2*radius + 'px';
    ripple.style.height = 2*radius + 'px';
    ripple.style.left = -radius + 'px';
    ripple.style.top = -radius + 'px';

    ripple.style.zIndex = 1;

    console.log(x, rippleRect.left, y, rippleRect.top)
    playRipple(ripple, x - rippleRect.left, y - rippleRect.top);

    var card = 
    

  };


  /**
   * Navigates to a new page. Uses ajax for data-ajax-link links.
   * @param {Event} e Event that triggered navigation.
   * @private
   */
  function handleAjaxLink(e, el) {
    e.preventDefault();
    e.stopPropagation();
    // We can get the full absolute path from the <a> element's pathname:
    // http://stackoverflow.com/questions/736513
    var pageName = parsePageNameFromAbsolutePath(el.pathname);
    var pageMeta = IOWA.Elements.Template.pages[pageName];
    IOWA.Elements.Template.nextPage = pageName;
    var color;
    var currentPage = IOWA.Elements.Template.selectedPage;
    if (currentPage !== pageName) {

      if (el.hasAttribute('data-anim-ripple')) {
        if (IOWA.Elements.Template.pages[currentPage].mastheadBgClass ===
            IOWA.Elements.Template.pages[pageName].mastheadBgClass) {
          color = '#fff';
        }
        var callback = function(el) {
          IOWA.History.pushState({'path': el.pathname}, '', el.href);
        };
        requestAnimationFrame(function() {
          //Wait for the ripple to finish.
          // TODO: give a smaller delay if chrome.
          IOWA.Elements.Template.rippleBgClass = IOWA.Elements.Template.pages[pageName].mastheadBgClass;
          playMastheadRipple(e.pageX, e.pageY, color);
          setTimeout(callback.bind(this, el), 500);
        });
      } else if (el.hasAttribute('data-anim-card'))  {
        requestAnimationFrame(function() {

          playCardTransition(el, e.pageX, e.pageY);
          //setTimeout(callback.bind(this, el), 500);
        });
        //IOWA.History.pushState({'path': el.pathname}, '', el.href);

      } else {
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
    // Allow user to open new tabs.
    if (e.metaKey || e.ctrlKey) {
      return;
    }
    // Inject page if <a> has the data-ajax-link attribute.
    for (var i = 0; i < e.path.length; ++i) {
      var el = e.path[i];
      if (el.localName === 'a' || el.localName === 'paper-button') {
        if (el.hasAttribute('data-track-link')) {
          IOWA.Analytics.trackEvent('link', 'click', el.getAttribute('data-track-link'));
        }
        if (el.hasAttribute('data-ajax-link')) {
          handleAjaxLink(e, el);
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
   * Runs animated page transition.
   * @param {string} pageName New page identifier.
   * @private
   */
  function animatePageIn(pageName) {
    // Prequery for content templates.
    var currentPageTemplates = document.querySelectorAll(
        '.js-ajax-' + pageName);
    IOWA.Elements.Template.pageTransitioningIn = false;
    IOWA.Elements.Template.pageTransitioningOut = true;
    // Replace content and end transition.
    setTimeout(function() {
      requestAnimationFrame(function() {
        replaceTemplateContent(currentPageTemplates);
        // Wait for a new frame before transitioning in.
        requestAnimationFrame(
          function() {
            IOWA.Elements.Template.pageTransitioningOut = false;
            IOWA.Elements.Template.pageTransitioningIn = true;
          }
        );
        // Transition in post-processing.
        document.body.id = 'page-' + pageName;
        IOWA.Elements.Template.selectedPage = pageName;
        var pageMeta = IOWA.Elements.Template.pages[pageName];
        document.title = pageMeta.title || 'Google I/O 2015';
        var masthead = IOWA.Elements.Masthead;
        masthead.className = masthead.className.replace(
            MASTHEAD_BG_CLASS_REGEX, ' ' + pageMeta.mastheadBgClass + ' ');
      });
    }, 600); // Wait for the ripple to play before transitioning.
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
    console.log('popstate')
    console.log(window.location.pathname)
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

  /**
   * Initialized ajax-based routing on the page.
   */
  function init() {
    window.addEventListener('popstate', renderCurrentPage);
    document.addEventListener('click', navigate);
  }

  return {
    init: init,
    getPageName: parsePageNameFromAbsolutePath
  };

})();
