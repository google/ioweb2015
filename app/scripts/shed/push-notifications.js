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

var DB_NAME = 'push-notifications-timestamp';
var DB_KEY = 'timestamp';

self.addEventListener('push', function(event) {
  var now;

  event.waitUntil(
    self.registration.pushManager.getSubscription().then(function(subscription) {
      if (!subscription || !subscription.subscriptionId) {
        throw Error('Unable to get the current subscription id.');
      }
      return subscription.subscriptionId;
    }).then(function(subscriptionId) {
      return simpleDB.open(DB_NAME).then(function(db) {
        return db.get(DB_KEY).then(function(timestamp) {
          var endpoint = 'api/v1/' + subscriptionId + '/notifications';
          var url = new URL(endpoint, self.location);
          if (timestamp) {
            url.search = 'since=' + encodeURIComponent(timestamp);
          }
          now = Date.now();
          return fetch(url);
        });
      });
    }).then(function(response) {
      if (response.status >= 400) {
        throw Error('The request to ' + response.url + ' failed: ' +
                    response.statusText + ' (' + response.status + ')');
      }
      return response.json();
    }).then(function(notifications) {
      return Promise.all(notifications.map(function(notification) {
        return self.registration.showNotification(notification.title, {
          body: notification.body,
          icon: notification.icon,
          tag: notification.tag
        });
      }));
    }).then(function() {
      return simpleDB.open(DB_NAME).then(function(db) {
        return db.set(DB_KEY, now);
      });
    }).catch(function(error) {
      console.error('Unable to handle event', event, 'due to error', error);
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('notificationclick:', event);
  /*// Android doesn't close the notification when you click on it
  // See: http://crbug.com/463146
  event.notification.close();

  // This looks to see if the current is already open and
  // focuses if it is
  event.waitUntil(
    self.clients.matchAll({
      type: "window"
    })
      .then(function(clientList) {
        for (var i = 0; i < clientList.length; i++) {
          var client = clientList[i];
          if (client.url == '/' && 'focus' in client)
            return client.focus();
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow('/');
        }
      })
  );*/
});
