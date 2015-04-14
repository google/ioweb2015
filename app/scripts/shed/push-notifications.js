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

var DB_KEY = 'token';
var DB_NAME = 'push-notification-updates';
var DEFAULT_ICON = 'images/touch/homescreen192.png';
var SESSIONS_ENDPOINT = 'api/v1/schedule';
var UPDATES_ENDPOINT = 'api/v1/user/updates';
var SESSION_DETAILS_URL_PREFIX = 'schedule?filters=#day';

/**
 * Loads a SW token value from IndexedDB.
 * @return {Promise} Resolves with the token, or null if there isn't one.
 */
function loadToken() {
  return simpleDB.open(DB_NAME).then(function(db) {
    return db.get(DB_KEY).then(function(token) {
      return token;
    });
  });
}

/**
 * Makes a request against the updates endpoint to determine which new notifications to display.
 * See https://github.com/GoogleChrome/ioweb2015/blob/master/docs/API.md#get-apiv1userupdates
 * @param {string} token A SW token associated with the current user.
 * @return {Promise} Resolves with a Response, or rejects on a network error.
 */
function fetchUpdates(token) {
  return fetch(new Request(UPDATES_ENDPOINT, {Authorization: token}));
}

/**
 * Deserializes a JSON body from a Response object.
 * @param {Response} response An HTTP response object with a JSON body.
 * @return {Promise} Resolves with an object representing the JSON in the response body, or rejects
 *                   if the Response was an HTTP error or didn't contain JSON.
 */
function parseResponseJSON(response) {
  if (response.status >= 400) {
    throw Error('The request to ' + response.url + ' failed: ' +
                response.statusText + ' (' + response.status + ')');
  }
  return response.json();
}

/**
 * Processes the updates response to show notifications for each update.
 * @param {object} body See https://github.com/GoogleChrome/ioweb2015/blob/master/docs/API.md#get-apiv1userupdates
 * @return {Promise} Resolves with a SW token that should be used the next time updates are fetched.
 *                   Rejects if there are any errors displaying notifications.
 */
function processResponse(body) {
  var notifications = generateSessionNotifications(body.sessions)
    .concat(generateVideoNotifications(body.videos))
    .concat(generateIOExtNotifications(body.ioext));

  return Promise.all(notifications.map(function(notification) {
    return self.registration.showNotification(notification.title, notification);
  })).then(function() {
    return body.token;
  });
}

/**
 * For each session that's passed in as a parameter, constructs the data needed to display a
 * notification.
 * Additionally, updates the cached session feed with the latest data from the update, to ensure
 * that if the session detail page is opened while offline, the details are up to date.
 * @param {array} updatedSessions One or more sessions.
 * @return {array} An array of objects with data that can be passed directly to
 *                   registration.showNotification()
 */
function generateSessionNotifications(updatedSessions) {
  // Ensure that we have an up-to-date sessions feed cached.
  // This will happen aysnchronously, independent from the notification creation, so it shouldn't be
  // necessary to wait on the promise resolutions.
  shed.helpers.openCache().then(function(cache) {
    cache.match(SESSIONS_ENDPOINT).then(function(response) {
      if (response) {
        // If there's a cached sessions feed, then update the changed fields and replace the cached
        // version with the updated version.
        parseResponseJSON(response).then(function(allSessions) {
          Object.keys(updatedSessions).forEach(function(sessionId) {
            allSessions[sessionId] = updatedSessions[sessionId];
          });

          cache.put(SESSIONS_ENDPOINT, new Response(JSON.stringify(allSessions)));
        });
      } else {
        // If there isn't anything already cached for the sessions feed, then cache the whole thing.
        shed.cache(SESSIONS_ENDPOINT);
      }
    });
  }).catch(function(error) {
    console.error('Could not update the cached sessions feed:', error);
  });

  return Object.keys(updatedSessions).map(function(sessionId) {
    var session = updatedSessions[sessionId];
    return {
      title: 'I/O session "' + session.title + '" was updated.',
      body: 'You previously starred this session.',
      icon: session.photoUrl || DEFAULT_ICON,
      tag: SESSION_DETAILS_URL_PREFIX + session.day + '/' + sessionId
    };
  });
}

function generateVideoNotifications(videos) {
  // TODO: Implement.
  return [];
}

function generateIOExtNotifications(videos) {
  // TODO: Implement.
  return [];
}

/**
 * Writes a SW token value to IndexedDB.
 * @param {string} token A SW token, returned from
 *                 https://github.com/GoogleChrome/ioweb2015/blob/master/docs/API.md#get-apiv1userupdates
 * @return {Promise} Resolves if the token is written successfully, and rejects otherwise.
 */
function saveToken(token) {
  return simpleDB.open(DB_NAME).then(function(db) {
    return db.set(DB_KEY, token);
  });
}

self.addEventListener('push', function(event) {
  event.waitUntil(
    loadToken()
      .then(fetchUpdates)
      .then(parseResponseJSON)
      .then(processResponse)
      .then(saveToken)
      .catch(function(error) {
        console.error('Unable to handle event', event, 'due to error', error);
      })
  );
});

self.addEventListener('notificationclick', function(event) {
  // Chrome displays a "default" notification if there isn't a notification shown in response to a
  // push event. We should ideally never get those, but just do a check first to make sure.
  if (event.notification.tag !== 'user_visible_auto_notification') {
    var url = new URL(event.notification.tag, location.href);
    clients.openWindow(url.toString());
  }
});
