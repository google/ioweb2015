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
  'use strict';

  var NOTIFY_ENDPOINT = 'api/v1/user/notify';

  /**
   * Globally enables push notifications for the current user, and passes along the browser's push
   * subscription id and endpoint value to the backend.
   * @param {string} subscriptionId The subscription.subscriptionId value.
   * @param {string} endpoint The subscription.endpoint value.
   * @return {Promise} Resolves with response body, or rejects with an error on HTTP failure.
   */
  var enableNotificationsPromise_ = function(subscriptionId, endpoint) {
    return IOWA.Request.xhrPromise('PUT', NOTIFY_ENDPOINT, true, {
      notify: true,
      subscriber: subscriptionId,
      endpoint: endpoint
    });
  };

  /**
   * Passes along the browser's push subscription id and endpoint value to the backend.
   * Does not change the notify value, so push notifications might be disabled globally for the
   * current user.
   * @param {string} subscriptionId The subscription.subscriptionId value.
   * @param {string} endpoint The subscription.endpoint value.
   * @return {Promise} Resolves with response body, or rejects with an error on HTTP failure.
   */
  var updateSubscriptionInfoPromise_ = function(subscriptionId, endpoint) {
    return IOWA.Request.xhrPromise('PUT', NOTIFY_ENDPOINT, true, {
      subscriber: subscriptionId,
      endpoint: endpoint
    });
  };

  /**
   * Disables push notifications globally for the current user.
   * @return {Promise} Resolves with response body, or rejects with an error on HTTP failure.
   */
  var disableNotificationsPromise_ = function() {
    return IOWA.Request.xhrPromise('PUT', NOTIFY_ENDPOINT, true, {notify: false});
  };

  /**
   * {boolean} Whether the browser supports all the prerequisites for using push notifications.
   */
  var isSupported = (window.ServiceWorkerRegistration &&
                     window.ServiceWorkerRegistration.prototype.showNotification &&
                     window.PushManager &&
                     window.Notification) ? true : false;

  /**
   * Checks whether the logged in user has notifications enabled globally on our backend.
   * @return {Promise} Resolves with the boolean value of the user's backend notification state.
   */
  var isNotifyEnabledPromise = function() {
    return IOWA.Request.xhrPromise('GET', NOTIFY_ENDPOINT, true).then(function(response) {
      return response.notify;
    }).catch(IOWA.Util.reportError);
  };

  /**
   * Checks whether the current browser already has a push subscription. If it does, the
   * the subscription id and endpoint value are passed along to the backend to ensure they're
   * up to date.
   * @return {Promise} Resolves with true if there's an existing subscription, or false otherwise.
   */
  var isExistingSubscriptionPromise = function() {
    return navigator.serviceWorker.ready.then(function(registration) {
      return registration.pushManager.getSubscription();
    }).then(function(subscription) {
      if (subscription && subscription.subscriptionId) {
        // Send the latest subscription id to the server, just in case it's changed.
        return updateSubscriptionInfoPromise_(subscription.subscriptionId, subscription.endpoint).then(function() {
          return true;
        }).catch(function() {
          // Return true even if the request to send the subscription id to the server fails, since
          // the user is subscribed.
          return true;
        });
      } else {
        return false;
      }
    }).catch(IOWA.Util.reportError);
  };

  /**
   * Ensures that there's a push subscription active for the current browser, and then passes along
   * the info to backend server, while also setting the global notification state to true.
   * @return {Promise} Resolves with notify endpoint response body on success.
   */
  var subscribePromise = function() {
    return navigator.serviceWorker.ready.then(function(registration) {
      return registration.pushManager.subscribe();
    }).then(function(subscription) {
      if (subscription && subscription.subscriptionId) {
        // If subscribing succeeds, send the subscription to the server. Return a resolved promise.
        return enableNotificationsPromise_(subscription.subscriptionId, subscription.endpoint);
      } else {
        // Otherwise, cause the promise to reject with an explanation of the error.
        if (window.Notification.permission === 'denied') {
          throw Error('Unable to subscribe due to permissions being denied.');
        } else {
          throw Error('Unable to subscribe due to an unknown error.');
        }
      }
    }).catch(IOWA.Util.reportError);
  };

  /**
   * Unregisters the push subscription for the current browser, and sets the global notification
   * state on the backend to false.
   * @return {Promise}
   */
  var unsubscribePromise = function() {
    var disablePushManager = navigator.serviceWorker.ready.then(function(registration) {
      return registration.pushManager.getSubscription();
    }).then(function(subscription) {
      if (subscription && subscription.subscriptionId) {
        return subscription.unsubscribe();
      }
    });

    return Promise.all(disableNotificationsPromise_(), disablePushManager)
      .catch(IOWA.Util.reportError);
  };

  var init = function() {
    if (!isSupported) {
      document.body.classList.add('nosupport-notifications');
    }
  };

  return {
    isExistingSubscriptionPromise: isExistingSubscriptionPromise,
    isNotifyEnabledPromise: isNotifyEnabledPromise,
    isSupported: isSupported,
    subscribePromise: subscribePromise,
    unsubscribePromise: unsubscribePromise,
    init: init
  };
})();
