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
var SCHEDULE_ENDPOINT = 'api/v1/schedule';
var UPDATES_ENDPOINT = 'api/v1/user/updates';
// Contains a mapping of notification tag values to the corresponding URL that should be opened
// when the notification is tapped/clicked.
var TAG_TO_DESTINATION_URL = {
  'session-details': 'schedule#myschedule'
};
var UTM_SOURCE_PARAM = 'utm_source=notification';

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
  return fetch(new Request(UPDATES_ENDPOINT, {
    headers: {
      Authorization: token
    }
  }));
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
  var notification = generateSessionNotification(body.sessions) || {
    // If for some reason we weren't able to parse out notification details from body.sessions, then
    // generate a default, "dummy" notification. Otherwise, Chrome 42/43 on Android will crash if
    // there's a push event and no notification is shown.
    title: 'Some events in My Schedule have been updated',
    body: '',
    icon: DEFAULT_ICON,
    tag: 'session-details'
  };

  return self.registration.showNotification(notification.title, notification).then(function() {
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
function generateSessionNotification(updatedSessions) {
  var sessionIds = Object.keys(updatedSessions);
  if (sessionIds.length) {
    // Ensure that we have an up-to-date sessions feed cached.
    // This will happen aysnchronously, independent from the notification creation, so it shouldn't be
    // necessary to wait on the promise resolutions.
    caches.open(shed.options.cacheName).then(function(cache) {
      cache.match(SCHEDULE_ENDPOINT).then(function(response) {
        if (response) {
          // If there's a cached sessions feed, then update the changed fields and replace the cached
          // version with the updated version.
          parseResponseJSON(response).then(function(schedule) {
            sessionIds.forEach(function(sessionId) {
              schedule.sessions[sessionId] = updatedSessions[sessionId];
            });

            cache.put(SCHEDULE_ENDPOINT, new Response(JSON.stringify(schedule)));
          });
        } else {
          // If there isn't anything already cached for the sessions feed, then cache the whole thing.
          shed.cache(SCHEDULE_ENDPOINT);
        }
      });
    }).catch(function(error) {
      console.error('Could not update the cached sessions feed:', error);
    });

    var updatedSessionsTitles = sessionIds.filter(function(sessionId) {
      // TODO(jeffposnick): Handle notifications for video/start updates.
      return updatedSessions[sessionId].update === 'details';
    }).map(function(sessionId) {
      return '"' + updatedSessions[sessionId].title + '"';
    });

    // New notifications with the same tag will replace any previous notifications with the same
    // tag, so there's no use sending multiple notifications with the same tag. Instead, create
    // one notification that has the list of all the session titles that were updated.
    return {
      title: 'Some events in My Schedule have been updated',
      body: updatedSessionsTitles.join(', ') +
            (updatedSessionsTitles.length === 1 ? ' was' : ' were') + ' updated.',
      icon: DEFAULT_ICON,
      tag: 'session-details'
    };
  }
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
  var relativeUrl = TAG_TO_DESTINATION_URL[event.notification.tag] || '/';
  var url = new URL(relativeUrl, location.href);
  url.search += (url.search ? '&' : '') + UTM_SOURCE_PARAM;
  self.clients.openWindow(url.toString());
});
