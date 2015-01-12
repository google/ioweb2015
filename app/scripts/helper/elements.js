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

    IOWA.Elements.Drawer = drawer;
    IOWA.Elements.Masthead = masthead;
    IOWA.Elements.Ripple = ripple;
    IOWA.Elements.Toast = toast;
    IOWA.Elements.IOLogo = ioLogo;
  };

  var init = function() {

    var template = document.getElementById('t');
    template.pages = {};
    var urlParts = location.href.split('/');
    template.selectedPage = urlParts[urlParts.length - 1] || 'home';
    template.pageTransitioning = false;

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

    template.addEventListener('template-bound', function() {
      updateElements();
      ioLogo.masthead = document.querySelector('.masthead');
      ioLogo.destination = document.querySelector('.masthead-container .io-logo');
    });

    updateElements();
    IOWA.Elements.Template = template;
  };

  return {
    init: init
  };
})();
