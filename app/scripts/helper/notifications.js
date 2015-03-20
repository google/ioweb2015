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

IOWA.Notifications = IOWA.Notifications || (function() {
  "use strict";

  var _sendSubscriptionIdToServerPromise = function(subscriptionId) {
    // no-op
  };

  var _removeSubscriptionIdFromServerPromise = function(subscriptionId) {
    // no-op
  };

  var isSupported = (ServiceWorkerRegistration &&
                     ServiceWorkerRegistration.prototype.showNotification &&
                     window.PushManager &&
                     Notification.permission &&
                     Notification.permission !== 'denied') ? true : false;

  var isAlreadySubscribedPromise = function() {
    return navigator.serviceWorker.ready.then(function(registration) {
      return registration.pushManager.getSubscription();
    }).then(function(subscription) {
      if (subscription && subscription.subscriptionId) {
        // Send the latest subscription id to the server, just in case it's changed.
        return _sendSubscriptionIdToServerPromise(subscription.subscriptionId).then(function() {
          return true;
        });
      } else {
        return false;
      }
    });
  };

  var subscribePromise = function() {
    return navigator.serviceWorker.ready.then(function(registration) {
      return registration.pushManager.subscribe();
    }).then(function(subscription) {
      if (subscription && subscription.subscriptionId) {
        // If subscribing succeeds, send the subscription to the server. Return a resolved promise.
        return _sendSubscriptionIdToServerPromise(subscription.subscriptionId);
      } else {
        // Otherwise, cause the promise to reject with an explanation of the error.
        if (Notification.permission === 'denied') {
          throw Error('Unable to subscribe due to permissions being denied.');
        } else {
          throw Error('Unable to subscribe due to an unknown error.');
        }
      }
    });
  };

  var unsubscribePromise = function() {
    return navigator.serviceWorker.ready.then(function(registration) {
      return registration.pushManager.getSubscription();
    }).then(function(subscription) {
      if (subscription && subscription.subscriptionId) {
        return _removeSubscriptionIdFromServerPromise(subscription.subscriptionId).then(function() {
          return subscription.unsubscribe();
        });
      }
    });
  };

  return {
    isAlreadySubscribedPromise: isAlreadySubscribedPromise,
    isSupported: isSupported,
    subscribePromise: subscribePromise,
    unsubscribePromise: unsubscribePromise
  };
})();
