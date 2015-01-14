/**
 * Copyright 2014 Google Inc. All rights reserved.
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

/**
 * @fileOverview History management for IOWA project.
 *
 * Triggers 'popstate' event on pushstate method call.
 */
IOWA.History = (function(exports) {
  var history = exports.history;
  var pushState = exports.history.pushState;

  history.pushState = function(state, title, url) {
    if (typeof history.onpushstate == "function") {
      history.onpushstate({state: state});
    }
    pushState.apply(history, [state, title, url]);
    
    var evt = new Event('popstate');
    evt.state = state;
    exports.dispatchEvent(evt);
  };

  exports.addEventListener('popstate', function(e, state) {
  	// TODO: Consider adding support for query strings and hashes, if needed.
    IOWA.Analytics.trackPageView(e.state && e.state.path);
  });

  return history;
})(window);
