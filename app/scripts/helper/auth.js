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

window.IOWA = window.IOWA || {};

IOWA.Auth = IOWA.Auth || (function() {

  "use strict";

  var tokenResponse_ = null;

  function getTokenResponse_() {
    return tokenResponse_;
  }

  document.addEventListener('signin-change', function(e) {
    var drawerProfilePic = IOWA.Elements.Drawer.querySelector('.profilepic');
    if (e.detail.user) {
      tokenResponse_ = e.detail.user.tokenResponse;
      drawerProfilePic.src = e.detail.user.image;
      drawerProfilePic.hidden = false;
    } else {
      tokenResponse_ = null;
      drawerProfilePic.hidden = true;
    }
  });

  return {
    getTokenResponse: getTokenResponse_
  };

})();
