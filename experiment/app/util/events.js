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

var { EventEmitter } = require('events');

/**
 * Tiny wrapper for a singleton event stream.
 */
module.exports = (function() {
  'use strict';

  var eventEmitter;

  return {
    addListener: function() {
      eventEmitter.addListener.apply(eventEmitter, arguments);
    },
    removeListener: function() {
      eventEmitter.removeListener.apply(eventEmitter, arguments);
    },
    emit: function() {
      eventEmitter.emit.apply(eventEmitter, arguments);
    },
    init: function() {
      eventEmitter = new EventEmitter();
      eventEmitter.setMaxListeners(20);
    }
  };
})();
