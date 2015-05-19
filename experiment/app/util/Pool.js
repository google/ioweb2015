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

var LinkedList = require('app/util/LinkedList');

/**
 * A pool of objects.
 * @constructor
 * @param {function} creator - Function that creates a type.
 * @param {function} prepare - Function that prepare an instance.
 * @param {number=100} poolChunkSize - How many items should be preallocated.
 */
module.exports = function Pool(creator, prepare, poolChunkSize) {
  'use strict';

  var pool_ = new LinkedList();
  var creator_ = creator;
  var prepare_ = prepare;
  var poolChunkSize_ = poolChunkSize || 100;
  var active = true;

  /**
   * Expand the pool.
   * @param {number} num - Number of objects to pre-allocate.
   */
  function preAllocate(num) {
    if (!active) { return; }

    for (let i = 0; i < num; i++) {
      pool_.push(creator_());
    }
  }

  /**
   * Get (or create) an object from the pool.
   * @return {object} The object.
   */
  function allocate() {
    if (!active) { return; }

    if (pool_.isEmpty()) {
      preAllocate(poolChunkSize_);
    }

    var v = pool_.pop();
    prepare_(v, arguments);

    return v;
  }

  /**
   * Return an object to the pool.
   * @param {object} obj - The obj to return.
   */
  function free(obj) {
    if (!active) { return; }

    pool_.push(obj);
  }

  /**
   * Destroy the pool itself.
   */
  function destroy() {
    pool_.length = 0;
    active = false;
  }

  return {
    preAllocate: preAllocate,
    allocate: allocate,
    free: free,
    destroy: destroy,
    size: () => pool_.count()
  };
};
