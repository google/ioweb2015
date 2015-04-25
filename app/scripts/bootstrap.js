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

(function() {
  // Polyfill Promise() in browsers that don't support it natively.
  ES6Promise.polyfill();

  function initWorker() {
    var MAX_WORKER_TIMEOUT_ = 10 * 1000; // 10s
    var worker;

    var doMetrics = window.performance && window.performance.now;

    if (doMetrics) {
      var workerStartTime = window.performance.now();
      worker = new Worker('data-worker-scripts.js');
      var total = window.performance.now() - workerStartTime;

      if (window.ENV !== 'prod') {
        console.info('worker startup:', total, 'ms');
      }
      IOWA.Analytics.trackPerf('worker', 'creation', Math.ceil(total),
                               null, MAX_WORKER_TIMEOUT_);
    } else {
      worker = new Worker('data-worker-scripts.js');
    }

    worker.addEventListener('message', function(e) {
      if (!e.data) {
        return;
      }

      var template = IOWA.Elements.Template;

      var data = e.data;
      if (data.scheduleData) {
        // Report how long the worker fetch took to GA.
        if (doMetrics) {
          var total = window.performance.now() - workerFetchTime;
          if (window.ENV !== 'prod') {
            console.info('worker fetch:', total, 'ms');
          }
          IOWA.Analytics.trackPerf('worker', 'data fetch', Math.ceil(total),
                                   null, MAX_WORKER_TIMEOUT_);
        }

        IOWA.Schedule.setScheduleData(data.scheduleData); // needed since the worker has a different cached copy.
        template.scheduleData = data.scheduleData;
        template.filterSessionTypes = data.tags.filterSessionTypes;
        template.filterThemes = data.tags.filterThemes;
        template.filterTopics = data.tags.filterTopics;

        // If user is signed in by this point, fetch their schedule.
        if (IOWA.Elements.GoogleSignIn.signedIn) {
          fetchUserSchedule();
        }
      }
    });

    var workerFetchTime;
    if (doMetrics) {
      workerFetchTime = window.performance.now();
    }

    worker.postMessage({cmd: 'FETCH_SCHEDULE'});
  }

  function afterImports() {
    IOWA.Elements.init();
    IOWA.Router.init(IOWA.Elements.Template);
    IOWA.Notifications.init();

    initWorker();

    CoreStyle.g.paperInput.labelColor = '#008094';
    CoreStyle.g.paperInput.focusedColor = '#008094';
  }

  function fetchUserSchedule() {
    var template = IOWA.Elements.Template;

    template.scheduleFetchingUserData = true;

    // Fetch user's saved sessions.
    IOWA.Schedule.fetchUserSchedule(function(savedSessions) {
      template.scheduleFetchingUserData = false;
      template.savedSessions = savedSessions;
      IOWA.Schedule.updateSavedSessionsUI(template.savedSessions);
    });
  }

  window.addEventListener('core-media-change', function(e) {
    // Disable swipping on tablet/desktop.
    if (e.target.id === 'mq-phone') {
      var isPhoneSize = e.detail.matches;
      IOWA.Elements.Drawer.querySelector('[drawer]').hidden = !isPhoneSize;
      IOWA.Elements.Drawer.disableSwipe = !isPhoneSize;
    }
  });

  window.addEventListener('keydown', function(e) {
    // ESC closes any overlays.
    if (e.keyCode === 27) {
      var template = IOWA.Elements.Template;
      if (template.photoGalleryActive) {
        template.togglePhotoGallery();
      }
      if (template.fullscreenVideoActive) {
        if (template.closeVideoCard) {
          template.closeVideoCard();
        }
        if (template.closeVideoSection) {
          template.closeVideoSection();
        }
      }
      if (template.extendedMapActive) {
        template.closeExtendedMapSection();
      }
    }
  });

  window.addEventListener('resize', function() {
    IOWA.Util.resizeRipple(IOWA.Elements.Ripple);
    IOWA.Elements.Drawer.closeDrawer();
  });

  // Watch for sign-in changes to fetch user schedule, update UI, etc.
  window.addEventListener('signin-change', function(e) {
    var template = IOWA.Elements.Template;

    if (e.detail.signedIn) {
      // User is logged in. Only fetch their schedule if the worker has
      // responded with the master schedule.
      if (template.scheduleData) {
        fetchUserSchedule();
      }
    } else {
      template.savedSessions = [];
      IOWA.Schedule.updateSavedSessionsUI(template.savedSessions);
      IOWA.Schedule.clearCachedUserSchedule();
    }
  });

  if (IOWA.Util.supportsHTMLImports) {
    afterImports();
  } else {
    document.addEventListener('polymer-ready', afterImports);
  }
})();
