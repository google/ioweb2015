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

  // TODO: Find a place to store constants that are shared between the controlled page and SW.
  var DB_KEY = 'token';
  var DB_NAME = 'push-notification-updates';
  var UPDATES_ENDPOINT = 'api/v1/user/updates';

  var tokenResponse_ = null;

  function getTokenResponse_() {
    return tokenResponse_;
  }

  function saveUpdatesToken_() {
    // Check to see if we already have an updates token in IDB.
    return simpleDB.open(DB_NAME).then(function(db) {
      return db.get(DB_KEY).then(function(token) {
        return token;
      });
    }).then(function(token) {
      // If there is no token (either because the user previously logged out, or because this is
      // our first time logging in), then get one from the server and store it in IDB.
      if (!token) {
        return IOWA.Request.xhrPromise('GET', UPDATES_ENDPOINT, true).then(function(response) {
          return simpleDB.open(DB_NAME).then(function(db) {
            return db.set(DB_KEY, response.token);
          });
        });
      }
    }).catch(IOWA.Util.logError);
  }

  // This should be called whenever the user logs out, since the updates token is associated with
  // the currently logged in user.
  function clearUpdatesToken_() {
    return simpleDB.open(DB_NAME).then(function(db) {
      return db.delete(DB_KEY);
    }).catch(IOWA.Util.logError);
  }

  document.addEventListener('signin-change', function(e) {
    var drawerProfilePic = IOWA.Elements.Drawer.querySelector('.profilepic');
    if (e.detail.user) {
      tokenResponse_ = e.detail.user.tokenResponse;
      drawerProfilePic.src = e.detail.user.picture;
      drawerProfilePic.hidden = false;
      saveUpdatesToken_();
    } else {
      tokenResponse_ = null;
      drawerProfilePic.hidden = true;
      clearUpdatesToken_();
    }
  });

  return {
    getTokenResponse: getTokenResponse_
  };

})();
