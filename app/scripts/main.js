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

(function(exports) {
  'use strict';

  exports.IOWA = exports.IOWA || {};

  // TODO(ericbidelman): add i18n support.
  // if (exports.ENV == 'dev') {
  //   // Polyfill needs I18nMsg to exist before setting the lang. Timing is fine for native.
  //   // Set locale for entire site (e.g. i18n-msg elements).
  //   document.addEventListener('HTMLImportsLoaded', function() {
  //     I18nMsg.lang = document.documentElement.lang || 'en';
  //   });
  // }

  // Pages that care to know when the page transitions are final should listen
  // for the page-transition-done event. It's the responsibility of the subpage
  // to  not add multiple listeners for this event on subsequent navigations.
  // exports.addEventListener('page-transition-done', function(e) {
  //   // TODO
  // })

  var MAX_WORKER_TIMEOUT_ = 3000;

  var showMetrics = (exports.ENV === 'dev' || exports.ENV === 'stage') &&
                     exports.performance && exports.performance.now;

  if (showMetrics) {
    var workerStartTime = exports.performance.now();
    exports.worker = new Worker('data-worker.js');
    var totalTime = exports.performance.now() - workerStartTime;

    console.info('worker startup:', totalTime, 'ms');
    IOWA.Analytics.trackPerf('worker', 'creation', Math.ceil(totalTime),
                             null, MAX_WORKER_TIMEOUT_);
  } else {
    exports.worker = new Worker('data-worker.js');
  }

  exports.worker.addEventListener('message', function(e) {
    if (showMetrics) {
      var totalTime = exports.performance.now() - workerRoundTripTime;
      console.info('worker fetch:', totalTime, 'ms');
      IOWA.Analytics.trackPerf('worker', 'data fetch', Math.ceil(totalTime),
                               null, MAX_WORKER_TIMEOUT_);
    }

    if (!e.data) {
      return;
    }

    var template = IOWA.Elements.Template;

    var data = e.data;
    if (data.scheduleData) {
      template.scheduleData = data.scheduleData;
      template.filterSessionTypes = data.tags.filterSessionTypes;
      template.filterThemes = data.tags.filterThemes;
      template.filterTopics = data.tags.filterTopics;
    }

    exports.worker = null;
  });

  var workerRoundTripTime;
  if (showMetrics) {
    workerRoundTripTime = exports.performance.now();
  }
  exports.worker.postMessage({cmd: 'FETCH_SCHEDULE'});

})(window);
