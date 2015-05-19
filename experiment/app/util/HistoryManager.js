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

module.exports = (function() {
  'use strict';

  /**
   * Central point for app-wide serializable state.
   * @constructor
   */
  return function HistoryManager() {
    var onOpenInstrumentCallback_;
    var onReturnToRootCallback_;
    var onCloseExperimentCallback_;

    var self = {
      onOpenInstrument,
      onReturnToRoot,
      onCloseExperiment,
      setState,
      pushState,
      init,
      tearDown,
      goBack
    };

    function onOpenInstrument(cb) {
      onOpenInstrumentCallback_ = cb;
    }

    function onReturnToRoot(cb) {
      onReturnToRootCallback_ = cb;
    }

    function onCloseExperiment(cb) {
      onCloseExperimentCallback_ = cb;
    }

    function setState(state) {
      history.replaceState({
        fromHashChange: true
      }, null, state);
    }

    function pushState(state) {
      history.pushState({
        fromHashChange: true
      }, null, state);
    }

    function goBack() {
      history.back();
    }

    function onHistoryChange() {
      if (document.location.hash === '#playing') {
        if ('function' === typeof onReturnToRootCallback_) {
          setTimeout(onReturnToRootCallback_, 50);
        }

        return;
      }

      var editingRegex = document.location.hash.match(/\#editing-(.*)/);

      if (editingRegex) {
        var editingPid = parseInt(editingRegex[1], 10);

        if (!isNaN(editingPid)) {
          setTimeout(onOpenInstrumentCallback_.bind(null, editingPid), 50);
        }

        return;
      }

      if (document.location.hash === '') {
        if ('function' === typeof onCloseExperimentCallback_) {
          setTimeout(onCloseExperimentCallback_, 50);
        }
      }
    }

    function init() {
      window.addEventListener('popstate', onHistoryChange);
    }

    function tearDown() {
      window.removeEventListener('popstate', onHistoryChange);
      pushState('#');
    }

    return self;
  };
})();
