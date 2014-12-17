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
