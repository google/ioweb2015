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
      if (el.localName == 'a') {
        if (el.hasAttribute('data-ajax-link')) {
          e.preventDefault();
          e.stopPropagation();
          renderPage(el.href);
          history.pushState(null, '', el.href);
          // TODO: Add GA pageview.
          // TODO: Update meta.
        }
        return; // found first anchor, quit here.
      }
    }
  }

  /**
   * Renders a new page by fetching partials through ajax.
   * @param {string} url The url of the new page.
   * @private
   */
  function renderPage(url) {
    var parts = url.split('/');
    var pageName = parts[parts.length - 1].split('.html')[0] || 'home';
    var importURL = 'templates/' + pageName + '_partial.html';

    Polymer.import([importURL], function() {
      // Don't proceed if import didn't load correctly.
      var htmlImport = document.querySelector(
          'link[rel="import"][href="' + importURL + '"]');
      if (htmlImport && !htmlImport.import) {
        return;
      }
      // Update content of the page.
      injectPageContent(pageName, htmlImport.import);
      // Update additional data on the page.
      document.body.id = 'page-' + pageName;
      IOWA.Elements.Template.selectedPage = pageName;
      var pageMeta = IOWA.Elements.Template.pages[pageName];
      document.title = pageMeta.title || 'Google I/O 2015';
    });
  }

  /**
   * Renders a new page for the current location.
   * @private
   */
  function renderCurrentPage() {
    renderPage(location.href);
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

    // Replace containers with the relevant content.
    var currentPageTemplates = document.querySelectorAll(
        '.js-ajax-' + pageName);
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
   * Initialized ajax-based routing on the page.
   */
  function init() {
    window.addEventListener('popstate', renderCurrentPage);
    // Load current page content when layout ready.
    // TODO: do we really need 2 requests instead of 1?
    document.addEventListener('template-bound', renderCurrentPage);
    document.addEventListener('click', navigate);
  }

  return {
    init: init
  };

})();
