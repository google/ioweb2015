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

(function(global) {
  var NOTIFICATION_UPDATES_DB_KEY = 'token';
  var NOTIFICATION_UPDATES_DB_NAME = 'push-notification-updates';
  var DEFAULT_ICON = 'images/touch/homescreen192.png';
  var SCHEDULE_ENDPOINT = 'api/v1/schedule';
  var UPDATES_ENDPOINT = 'api/v1/user/updates';
  // Contains a mapping of notification tag values to the corresponding URL that should be opened
  // when the notification is tapped/clicked.
  var TAG_TO_DESTINATION_URL = {
    'session-details': 'schedule#myschedule',
    'io-soon': './',
    'session-start': 'schedule#myschedule',
    'video-available': 'schedule#myschedule',
    survey: 'schedule#myschedule'
  };
  var UTM_SOURCE_PARAM = 'utm_source=notification';
  var SESSION_DEEPLINK_PREFIX = 'schedule?sid=';

  /**
   * Loads a SW token value from IndexedDB.
   * @return {Promise} Resolves with the token, or null if there isn't one.
   */
  function loadToken() {
    return global.simpleDB.open(NOTIFICATION_UPDATES_DB_NAME).then(function(db) {
      return db.get(NOTIFICATION_UPDATES_DB_KEY).then(function(token) {
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
    return global.fetch(new Request(UPDATES_ENDPOINT, {
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
    var updates = {};
    Object.keys(body.sessions).forEach(function(sessionId) {
      var session = body.sessions[sessionId];
      if (Array.isArray(updates[session.update])) {
        updates[session.update].push(session);
      } else {
        updates[session.update] = [session];
      }
    });

    var notificationGenerators = {
      details: generateDetailsNotification,
      soon: generateSoonNotification,
      start: generateStartNotification,
      video: generateVideoNotification,
      survey: generateSurveyNotification
    };

    var notifications = Object.keys(updates).filter(function(updateType) {
      return updateType in notificationGenerators;
    }).map(function(updateType) {
      return notificationGenerators[updateType](updates[updateType]);
    });

    if (notifications.length) {
      return Promise.all(notifications.map(function(notification) {
        return global.registration.showNotification(notification.title, notification);
      })).then(function() {
        return body.token;
      });
    } else {
      throw Error('Unable to generate notification details.');
    }
  }

  /**
   * For each session that's passed in as a parameter, constructs the data needed to display a
   * notification.
   * Additionally, updates the cached session feed with the latest data from the update, to ensure
   * that if the session detail page is opened while offline, the details are up to date.
   * @param {array} sessions One or more sessions.
   * @return {object} An object with the data needed to display a notification.
   */
  function generateDetailsNotification(sessions) {
    // Ensure that we have an up-to-date sessions feed cached.
    // This will happen aysnchronously, independent from the notification creation, so it shouldn't be
    // necessary to wait on the promise resolutions.
    global.caches.open(global.shed.options.cacheName).then(function(cache) {
      cache.match(SCHEDULE_ENDPOINT).then(function(response) {
        if (response) {
          // If there's a cached sessions feed, then update the changed fields and replace the cached
          // version with the updated version.
          parseResponseJSON(response).then(function(schedule) {
            sessions.forEach(function(session) {
              schedule.sessions[session.id] = session;
            });

            cache.put(SCHEDULE_ENDPOINT, new Response(JSON.stringify(schedule)));
          });
        } else {
          // If there isn't anything already cached for the sessions feed, then cache the whole thing.
          global.shed.cache(SCHEDULE_ENDPOINT);
        }
      });
    }).catch(function(error) {
      console.error('Could not update the cached sessions feed:', error);
    });

    var sessionTitles = formatSessionTitles(sessions);

    // New notifications with the same tag will replace any previous notifications with the same
    // tag, so there's no use sending multiple notifications with the same tag. Instead, create
    // one notification that has the list of all the session titles that were updated.
    return {
      title: 'Some events in My Schedule have been updated',
      body: sessionTitles.join(', ') +
            (sessionTitles.length === 1 ? ' was' : ' were') + ' updated.',
      icon: DEFAULT_ICON,
      tag: 'session-details'
    };
  }

  /**
   * Generates the notification details for the "Google I/O is starting soon"-style notification.
   * @return {object} An object with the data needed to display a notification.
   */
  function generateSoonNotification() {
    return {
      title: 'Google I/O is starting soon',
      body: 'Watch the Keynote live at 9:30am PDT on May 28.',
      icon: DEFAULT_ICON,
      tag: 'io-soon'
    };
  }

  /**
   * Generates the notification details for the "session is starting soon"-style notification.
   * @param {array} sessions One or more sessions.
   * @return {object} An object with the data needed to display a notification.
   */
  function generateStartNotification(sessions) {
    var sessionsStartingSoon = [];
    var sessionsStarted = [];

    var now = Date.now();
    sessions.forEach(function(session) {
      var startTime = new Date(session.startTimestamp).getTime();
      if (startTime <= now) {
        sessionsStarted.push(session);
      } else {
        sessionsStartingSoon.push(session);
      }
    });

    var sessionsStartingSoonTitles = formatSessionTitles(sessionsStartingSoon);
    var sessionsStartedTitles = formatSessionTitles(sessionsStarted);

    var body = '';
    var title = '';
    if (sessionsStartingSoonTitles.length) {
      title = 'Some events in My Schedule are starting';
      body += sessionsStartingSoonTitles.join(', ') +
              (sessionsStartingSoonTitles.length === 1 ? ' is' : ' are') + ' starting soon. ';
    }
    if (sessionsStartedTitles.length) {
      if (title) {
        title = 'Session reminder';
      } else {
        title = 'Some events in My Schedule have started';
      }

      body += sessionsStartedTitles.join(', ') +
              (sessionsStartedTitles.length === 1 ? ' has' : ' have') + ' already started. ';
    }

    // New notifications with the same tag will replace any previous notifications with the same
    // tag, so there's no use sending multiple notifications with the same tag. Instead, create
    // one notification that has the list of all the sessions starting soon.
    return {
      title: title,
      body: body,
      icon: DEFAULT_ICON,
      tag: 'session-start'
    };
  }

  /**
   * Generates the notification details for the "session videos are available"-style notification.
   * @param {array} sessions One or more sessions.
   * @return {object} An object with the data needed to display a notification.
   */
  function generateVideoNotification(sessions) {
    var sessionTitles = formatSessionTitles(sessions);

    // Special-case logic to handle the case where there's just one new video, since we can
    // make the clickthrough go directly to the session page.
    if (sessionTitles.length === 1) {
      var tag = SESSION_DEEPLINK_PREFIX + sessions[0].id + '#/' + sessions[0].id;

      return {
        title: 'The video for ' + sessionTitles[0] + ' is available',
        body: '',
        icon: DEFAULT_ICON,
        tag: tag
      };
    } else {
      return {
        title: 'Some events in My Schedule have new videos',
        body: 'New videos are available for ' + sessionTitles.join(', '),
        icon: DEFAULT_ICON,
        tag: 'video-available'
      };
    }
  }

  /**
   * @param {Array} sessions One or more sessions.
   * @return {array} An array of all the titles for the session, surrounded by quotes.
   */
  function formatSessionTitles(sessions) {
    return sessions.map(function(session) {
      return '"' + session.title + '"';
    });
  }

  /**
   * @return {object} An object with the data needed to display a notification.
   */
  function generateSurveyNotification() {
    return {
      title: 'Remember to rate the events you attended',
      body: 'We value your feedback!',
      icon: DEFAULT_ICON,
      tag: 'survey'
    };
  }

  /**
   * Writes a SW token value to IndexedDB.
   * @param {string} token A SW token, returned from
   *                 https://github.com/GoogleChrome/ioweb2015/blob/master/docs/API.md#get-apiv1userupdates
   * @return {Promise} Resolves if the token is written successfully, and rejects otherwise.
   */
  function saveToken(token) {
    return global.simpleDB.open(NOTIFICATION_UPDATES_DB_NAME).then(function(db) {
      return db.set(NOTIFICATION_UPDATES_DB_KEY, token);
    });
  }

  global.addEventListener('push', function(event) {
    event.waitUntil(
      loadToken()
        .then(fetchUpdates)
        .then(parseResponseJSON)
        .then(processResponse)
        .then(saveToken)
        .catch(function(error) {
          console.error('Unable to handle event', event, 'due to error', error);
          var notification = {
            title: 'Some events in My Schedule have been updated',
            body: '',
            icon: DEFAULT_ICON,
            tag: error.toString()
          };
          return global.registration.showNotification(notification.title, notification);
        })
    );
  });

  global.addEventListener('notificationclick', function(event) {
    event.notification.close();

    var relativeUrl = TAG_TO_DESTINATION_URL[event.notification.tag];
    // If the tag isn't mapped to a destination URL, check to see if it's a deep link to a session.
    if (!relativeUrl) {
      if (event.notification.tag.indexOf(SESSION_DEEPLINK_PREFIX) === 0) {
        relativeUrl = event.notification.tag;
      }
    }

    // If the tag is still unknown, it's most likely because it's being used to track an error that
    // led to a default notification. Put that error info into a URL parameter, and take the
    // use to the home page.
    if (!relativeUrl) {
      // The URL constructor will handle escaping/URL encoding.
      relativeUrl = './?utm_error=' + event.notification.tag;
    }

    var url = new URL(relativeUrl, global.location.href);
    url.search += (url.search ? '&' : '') + UTM_SOURCE_PARAM;

    event.waitUntil(global.clients.openWindow(url.toString()));
  });
})(self);
