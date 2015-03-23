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

function loadToken() {
  return simpleDB.open(DB_NAME).then(function(db) {
    return db.get(DB_KEY).then(function(token) {
      return token;
    });
  });
}

function fetchUpdates(token) {
  return fetch(new Request(UPDATES_ENDPOINT, {Authorization: token}));
}

function parseResponse(response) {
  if (response.status >= 400) {
    throw Error('The request to ' + response.url + ' failed: ' +
                response.statusText + ' (' + response.status + ')');
  }
  return response.json();
}

function processResponse(json) {
  var notifications = generateSessionNotifications(json.sessions)
    .concat(generateVideoNotifications(json.videos))
    .concat(generateExtNotifications(json.ext));

  return Promise.all(notifications.map(function(notification) {
    return self.registration.showNotification(notification.title, notification);
  })).then(function() {
    return json.token;
  });
}

function generateSessionNotifications(sessions) {
  return shed.networkFirst(SESSIONS_ENDPOINT).then(parseResponse).then(function(json) {
    return sessions.reduce(function(notifications, session) {
      if (json.session) {
        notifications.append({
          title: 'Session "' + json.session.title + '" was updated.',
          body: 'You previously starred this session.',
          icon: DEFAULT_ICON,
          tag: 'session-' + session
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
