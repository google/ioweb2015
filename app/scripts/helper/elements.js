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

    var parentRect = ripple.parentNode.getBoundingClientRect();

    var radius = Math.floor(Math.sqrt(parentRect.width*parentRect.width + 
      parentRect.height*parentRect.height));
    
    ripple.style.width = 2*radius + 'px';
    ripple.style.height = 2*radius + 'px';
    ripple.style.left = -radius + 'px';
    ripple.style.top = -radius + 'px';


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
      IOWA.PageAnimation.play(IOWA.PageAnimation.slideContentIn());
    });
  };

  var init = function() {
    var template = document.getElementById('t');
    template.pages = {};
    template.selectedPage = IOWA.Router.getPageName(window.location.pathname);

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
    template.mastheadBgClass = template.pages[template.selectedPage];

    template.addEventListener('template-bound', updateElements);

    IOWA.Elements.Template = template;
    IOWA.Elements.ScrollContainer = document.querySelector(
        'core-drawer-panel > div[main]');
  };

  return {
    init: init
  };
})();
