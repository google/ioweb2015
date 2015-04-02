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

  function setUserUI(user) {
    tokenResponse_ = user.tokenResponse;

    var drawerProfilePic = IOWA.Elements.Drawer.querySelector('.profilepic');
    drawerProfilePic.src = user.picture;
    drawerProfilePic.hidden = false;

    // Set notifications checkbox appropriately in settings UI.
    IOWA.Notifications.isNotifyEnabledPromise().then(function(notify) {
      IOWA.Elements.GoogleSignIn.user.notify = notify;
    });
  }

  function clearUserUI() {
    tokenResponse_ = null;

    var drawerProfilePic = IOWA.Elements.Drawer.querySelector('.profilepic');
    drawerProfilePic.hidden = true;

    var signInButton = IOWA.Elements.Nav.querySelector('.button-link');
    signInButton.removeAttribute('disabled');

    // TODO(jeffy): user just signed out. Stop notifications?
  }

  /**
   * Ensures that we have a valid token in IndexedDB used by the service worker to fetch updates.
   * @return {Promise}
   */
  function ensureSWToken_() {
    // Check to see if we already have a SW token in IDB.
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
    }).catch(IOWA.Util.reportError);
  }

  /**
   * Removes the token in IndexedDB used by the service worker to fetch updates.
   * This should be called whenever the user logs out, since the SW token is associated with
   * the currently logged in user.
   * @return {Promise}
   */
  function clearSWToken_() {
    return simpleDB.open(DB_NAME).then(function(db) {
      return db.delete(DB_KEY);
    }).catch(IOWA.Util.reportError);
  }

  document.addEventListener('signin-change', function(e) {
    if (e.detail.user) {
      setUserUI(e.detail.user);
      ensureSWToken_(); // This kicks off an async network request, wrapped in a promise.
    } else {
      clearUserUI();
      clearSWToken_(); // This kicks off an async network request, wrapped in a promise.
    }
  });

  document.addEventListener('signin-fail', clearUserUI);

  return {
    getTokenResponse: getTokenResponse_
  };

})();
