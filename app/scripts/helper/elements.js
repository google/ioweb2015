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

    var drawer = document.querySelector('core-drawer-panel');
    drawer.addEventListener('core-activate', function(e) {
      this.closeDrawer();
    });

    var ripple = document.querySelector('.masthead__ripple__content');
    var main = document.querySelector('main');
    var masthead = document.querySelector('.masthead');
    var header = document.querySelector('.masthead-container');

    IOWA.Elements.Drawer = drawer;
    IOWA.Elements.Header = header;
    IOWA.Elements.Main = main;
    IOWA.Elements.Masthead = masthead;
    IOWA.Elements.Ripple = ripple;
    IOWA.Elements.Toast = toast;
  };

  var init = function() {

    var template = document.getElementById('t');
    template.pages = {};
    template.selectedPage = 'home';

    var cyan = '#00BCD4';
    var mediumGrey = '#CFD8DC';
    var darkGrey = '#455A64';

    template.pages = {
      'schedule': {
        bgColor: cyan,
        mastheadBgClass: 'bg-cyan'
      },
      'home': {
        bgColor: mediumGrey,
        mastheadBgClass: 'bg-medium-grey'
      },
      'about': {
        bgColor: darkGrey,
        mastheadBgClass: 'bg-dark-grey'
      },
      'onsite': {
        bgColor: darkGrey,
        mastheadBgClass: 'bg-dark-grey'
      },
      'offsite': {
        bgColor: cyan,
        mastheadBgClass: 'bg-cyan'
      },
      'registration': {
        bgColor: cyan,
        mastheadBgClass: 'bg-cyan'
      }
    };

    t.addEventListener('template-bound', function() {
      updateElements();
    });

    updateElements();
    IOWA.Elements.Template = template;
  };

  return {
    init: init
  };
})();
