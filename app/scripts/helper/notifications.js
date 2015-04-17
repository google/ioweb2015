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
  var pendingResolutions = [];

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
  var disableNotificationsPromise = function() {
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
    }).then(function() {
      while (pendingResolutions.length) {
        var pendingResolution = pendingResolutions.shift();
        pendingResolution();
      }
    }).catch(IOWA.Util.reportError);
  };

  /**
   * Unsubscribe the push subscription for the current browser.
   * @return {Promise}
   */
  var unsubscribeFromPushManagerPromise = function() {
    return navigator.serviceWorker.ready.then(function(registration) {
      return registration.pushManager.getSubscription();
    }).then(function(subscription) {
      if (subscription && subscription.subscriptionId) {
        return subscription.unsubscribe();
      }
    });
  };

  var init = function() {
    if (!isSupported) {
      document.body.classList.add('nosupport-notifications');
    }
  };

  /**
   * Provides a Promise which is resolved after all prerequisites for enabling notifications have
   * been met. Specifically:
   * - User must be signed in.
   * - Global notifications checkbox must be checked.
   * - Notification permissions for the browser must be enabled.
   * This promise can be used to wait for all those prerequisites to be met. It will take care of
   * prompting the user for the various steps that need to be taken.
   * As an alternative, if you want similar behavior but only want to wait until the user is signed
   * in (regardless of notification state), use IOWA.Auth.waitForSignedIn() directly.
   *
   * Usage:
   * function someUIButtonClicked() {
   *   IOWA.Notifications.waitForPrereqs().then(function() {
   *     // At this point you can do something that requires being signed in and having
   *     // notifications enabled, like adding a sessionId to the list of subscribed sessions.
   *   });
   * }
   *
   * @return {Promise} Resolves once all the prerequisites for showing notifications are met.
   *                   Rejects if Notification.permission === 'denied' and the Permissions API
   *                   (added in Chrome 43) is unavailable, meaning we can't listen for permission
   *                   changes.
   *                   Also rejects if the browser doesn't support notifications.
   */
  var waitForPrereqs = function() {
    if (!isSupported) {
      return Promise.reject();
    }

    return IOWA.Auth.waitForSignedIn()
      .then(waitForNotificationsEnabled_)
      .then(function() {
        return new Promise(function(resolve, reject) {
          // window.Notification.permission is used for compatability with Chrome 42.
          if (window.Notification.permission === 'granted') {
            resolve();
          } else if (window.Notification.permission === 'denied') {
            IOWA.Elements.Toast.showMessage('Please enable the page setting for notifications', null, 'Learn how', function() {
              window.open('permissions', '_blank');
            });

            if (navigator.permissions) {
              // If the Permissions API is available (in Chrome 43 and higher), then we can listen
              // for changes to the notification permission and resolve when it's 'granted'.
              navigator.permissions.query({name: 'notifications'}).then(function(p) {
                p.onchange = function() {
                  if (this.status === 'granted') {
                    resolve();
                  }
                };
              });
            } else {
              reject('Notification permissions are denied and the Permissions API is not available.');
            }
          }
        });
      });
  };

  /**
   * Useful to coordinate activities that need to take place after the user has enabled the
   * global notifications settings.
   * @param {string} message The text displayed in the toast.
   *                         Defaults to 'Please enable the notification setting'
   * @return {Promise} Resolves when the global notifications option is enabled. Does not reject.
   */
  function waitForNotificationsEnabled_(message) {
    message = message || 'Please enable the notification setting';

    // Check to see if notifications are already enabled.
    return isNotifyEnabledPromise().then(function(isEnabled) {
      if (isEnabled && window.Notification.permission === 'granted') {
        return Promise.resolve();
      } else {
        // If notifications are not already enabled, then return a Promise which will resolve later
        // on, if/when updateNotifyUser() is called as a result of the box being checked.
        return new Promise(function(resolve) {
          pendingResolutions.push(resolve);
          IOWA.Elements.Toast.showMessage(message, null, 'Open', function() {
            // Assigning this to IOWA.Elements.SignInSettings wasn't possible, since it's
            // wrapped in a <template if="{{currentUser}}">.
            // TODO: This doesn't display nicely when there's already an open overlay.
            document.querySelector('#signin-settings-panel').open();
          });
        });
      }
    });
  }

  return {
    disableNotificationsPromise: disableNotificationsPromise,
    init: init,
    isExistingSubscriptionPromise: isExistingSubscriptionPromise,
    isNotifyEnabledPromise: isNotifyEnabledPromise,
    isSupported: isSupported,
    subscribePromise: subscribePromise,
    unsubscribeFromPushManagerPromise: unsubscribeFromPushManagerPromise,
    waitForPrereqs: waitForPrereqs
  };
})();
