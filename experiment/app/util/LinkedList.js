/**
 * An array of available nodes.
 * @type {array}
 * @private
 */
var nodePool_ = [];


/**
 * The number of created nodes.
 * @type {number}
 * @private
 */
var nodesCreated_ = 0;



/**
 * A doubly linked list.
 * @constructor
 */
module.exports = function() {
  'use strict';

  var head_ = null;
  var tail_ = null;
  var count = 0;

  /**
   * Get a node from the pool.
   * @private
   * @return {object}
   */
  function getNode_() {
    if (nodePool_.length) {
      return nodePool_.pop();
    } else {
      nodesCreated_++;

      return {
        next: null,
        prev: null,
        obj: null
      };
    }
  }

  /**
   * Return a node to the pool.
   * @private
   * @param {object} n The node.
   */
  function returnNode_(n) {
    n.next = null;
    n.prev = null;
    n.obj = null;
    nodePool_.push(n);
  }

  /**
   * Wrap an object in a node.
   * @private
   * @param {object} objToWrap Incoming object.
   * @return {object}
   */
  function makeNode_(objToWrap) {
    var n = getNode_();
    n.obj = objToWrap;
    return n;
  }

  /**
   * Push a new item onto the end list.
   * @param {object} objToInsert An object to push into the list.
   */
  function push(objToInsert) {
    var node = makeNode_(objToInsert);

    node.prev = tail_;

    if (tail_ !== null) {
      tail_.next = node;
    }

    tail_ = node;
    node.next = null;

    if (head_ === null) {
      head_ = node;
    }

    count++;
  }

  /**
   * Unshift a new item onto the front the list.
   * @param {object} objToInsert An object to push into the list.
   */
  function unshift(objToInsert) {
    var node = makeNode_(objToInsert);

    node.next = head_;
    if (head_ !== null) {
      head_.prev = node;
    }
    head_ = node;
    node.prev = null;

    if (tail_ === null) {
      tail_ = node;
    }

    count++;
  }

  /**
   * Is the list empty?
   * @return {boolean} If the list is empty.
   */
  function isEmpty() {
    return !count;
  }

  /**
   * Remove the tail item from the list.
   * @return {object} The popped object.
   */
  function pop() {
    if (!isEmpty()) {
      var currentTail = tail_;
      return remove(currentTail.obj);
    }
  }

  /**
   * Remove the head item from the list.
   * @return {object} The shifted object.
   */
  function shift() {
    if (!isEmpty()) {
      var currentHead = head_;
      return remove(currentHead.obj);
    }
  }

  /**
   * Loop over the list.
   * @param {function} iterator The function to call on each item.
   * @param {object} scope The iterator scope.
   */
  function forEach(iterator, scope) {
    var current = head_;

    var i = 0;
    while (current) {
      iterator.call(scope, current.obj, i++);
      current = current.next;
    }
  }

  /**
   * Remove an element from the list.
   * @param {object} objectToRemove The target object.
   * @return {object} Removed object.
   */
  function remove(objectToRemove) {
    var node;
    var current = head_;

    while (!node && current) {
      if (current.obj === objectToRemove) {
        node = current;
      }

      current = current.next;
    }

    if (node) {
      if (node.prev === null) {
        head_ = node.next;
      } else {
        node.prev.next = node.next;
      }

      if (node.next === null) {
        tail_ = node.prev;
      } else {
        node.next.prev = node.prev;
      }

      count--;
      returnNode_(node);
    }

    return objectToRemove;
  }

  return {
    push: push,
    unshift: unshift,
    isEmpty: isEmpty,
    pop: pop,
    shift: shift,
    forEach: forEach,
    remove: remove,
    count: () => count
  };
};
