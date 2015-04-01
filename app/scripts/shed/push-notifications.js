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
function parseResponse(response) {
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
    .concat(generateExtNotifications(body.ext));

  return Promise.all(notifications.map(function(notification) {
    return self.registration.showNotification(notification.title, notification);
  })).then(function() {
    return body.token;
  });
}

/**
 * Returns metadata about a session, given a list of sessions and an id.
 * @param {array} sessions A list of sessions, in the format returned by
 *                https://github.com/GoogleChrome/ioweb2015/blob/master/docs/API.md#get-apiv1schedule
 * @param {string} sessionId A session id, corresponding to the id field of an entry in sessions.
 * @return {object} Metadata about the session with id sessionId, or null if it's not in sessions.
 */
function lookupSession(sessions, sessionId) {
  // Looping is probably more efficient than, e.g., creating and reusing an object keyed on session
  // ids, since we probably won't be calling lookupSession() more than once before the SW is killed.
  var sessionsLength = sessions.length;
  for (var i = 0; i < sessionsLength; i++) {
    if (sessions[i].id === sessionsId) {
      return sessions[i];
    }
  }

  return null;
}

/**
 * Fetches the latest list of sessions from the network (which also updates the cached Response).
 * For each session id that's passed in as a parameter, constructs the data needed to display a
 * notification from the fresh session response.
 * @param {array} sessionIds One or more session ids.
 * @return {Promise} Resolves with an array of objects with data that can be passed directly to
 *                   registration.showNotification()
 */
function generateSessionNotifications(sessionIds) {
  return shed.networkFirst(SESSIONS_ENDPOINT).then(parseResponse).then(function(sessions) {
    return sessionIds.reduce(function(notifications, sessionId) {
      var session = lookupSession(sessions, sessionId);
      if (session) {
        notifications.append({
          title: 'Session "' + session.title + '" was updated.',
          body: 'You previously starred this session.',
          icon: DEFAULT_ICON,
          // TODO (jeffposnick): Ensure that there's something meaningful set for tag so that
          // notifications collapse properly.
          tag: 'session-' + sessionId
        });
      }
      return notifications;
    }, []);
  });
}

function generateVideoNotifications(videos) {
  // TODO: Implement.
  return [];
}

function generateExtNotifications(videos) {
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
      .then(parseResponse)
      .then(processResponse)
      .then(saveToken)
      .catch(function(error) {
        console.error('Unable to handle event', event, 'due to error', error);
      })
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('notificationclick:', event);
  // TODO: Implement.
});
