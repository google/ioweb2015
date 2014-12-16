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

IOW.Elements = (function() {

  "use strict";

  var toast = document.getElementById('toast');

  function configureToast() {
    // TODO: Just an example for listening to schedule changes. Temporary.
    var schedule = document.querySelector('sw-schedule');
    toast.listen(schedule, 'message', 'message');
  }

  if (toast.listen) {
    configureToast();
  } else {
    window.addEventListener('polymer-ready', configureToast);
  }

  return {
    Toast: toast
  };

})();
