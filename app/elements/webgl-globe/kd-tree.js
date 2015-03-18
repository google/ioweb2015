/**
 * Copyright 2015 Google Inc. All Rights Reserved.
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

/* global IOWA */

/**
 * @typedef {{
 *   x: number,
 *   y: number,
 *   z: number,
 *   index: number,
 *   left: ?IOWA.WebglGlobe.KdNode,
 *   right: ?IOWA.WebglGlobe.KdNode
 * }}
 */
IOWA.WebglGlobe.KdNode;

/**
 * A three-dimensional k-d tree constructed from positions specified by latitude
 * and longitude. Points cannot be added or removed after construction. The
 * nearest neighbor queries return results in terms of an index (or indices)
 * into the `points` array provided to the constructor. Points are assumed to be
 * on a spherical globe and so should be used with caution (or not at all) when
 * precision is required. The points' `lat` and `lng` properties are used for
 * spatial sorting; the index within the `points` array is used to disambiguate
 * points at the exact same location, so when there are coincident points. the
 * order of the array will affect query results.
 * @param {!Array<{lat: number, lng: number}>} points
 * @constructor
 * @struct
 */
IOWA.WebglGlobe.KdTree = function(points) {
  var xsorted = [];
  var ysorted = [];
  var zsorted = [];

  for (var i = 0; i < points.length; i++) {
    // Find cartesian coordinates (assuming a spherical globe).
    var lat = points[i].lat * (Math.PI / 180);
    var lng = points[i].lng * (Math.PI / 180);
    var cosLat = Math.cos(lat);
    var x = Math.sin(lng) * cosLat;
    var y = Math.sin(lat);
    var z = Math.cos(lng) * cosLat;

    var kdPoint = /** @type {IOWA.WebglGlobe.KdNode} */({
      x: x,
      y: y,
      z: z,
      index: i,
      left: null,
      right: null
    });

    xsorted[i] = kdPoint;
    ysorted[i] = kdPoint;
    zsorted[i] = kdPoint;
  }

  xsorted.sort(IOWA.WebglGlobe.KdTree.compareX_);
  ysorted.sort(IOWA.WebglGlobe.KdTree.compareY_);
  zsorted.sort(IOWA.WebglGlobe.KdTree.compareZ_);

  // TODO(bckenny): just build as you go
  var root = IOWA.WebglGlobe.KdTree.build_(xsorted, ysorted, zsorted, 0);

  /**
   * The actual kd tree, stored as a flat array. The tree is complete and cannot
   * have nodes added or deleted, so store_ can densely pack into array. Layout
   * of the nodes in the array: [..., pointsIndex, x, y, z, ...]. For a node at
   * index i, its left child is at 2i + 4 and its right child is at 2i + 8.
   * @private {!Float64Array}
   */
  this.store_ = IOWA.WebglGlobe.KdTree.buildFlatStore_(root, 0,
      new Float64Array(points.length * 4));

  var treeHeight = IOWA.WebglGlobe.KdTree.intLogBase2_(points.length);

  /**
   * A stack for indices while traversing the tree iteratively, sized exactly
   * for this tree.
   * @private {!Int32Array}
   */
  this.indexStack_ = new Int32Array(treeHeight + 1);

  /**
   * A stack for distances to nodes while traversing the tree iteratively, sized
   * exactly for this tree.
   * @private {!Float64Array}
   */
  this.distanceStack_ = new Float64Array(treeHeight + 1);
};

/**
 * Comparator function for sorting KdData values in x. If two objects have the
 * same x value, they are sorted in y, and if equal there, by z, and if equal
 * there, by unique index.
 * @param {IOWA.WebglGlobe.KdNode} a
 * @param {IOWA.WebglGlobe.KdNode} b
 * @return {number}
 * @private
 */
IOWA.WebglGlobe.KdTree.compareX_ = function(a, b) {
  if (a.x < b.x) {
    return -1;
  }
  if (a.x > b.x) {
    return 1;
  }

  if (a.y < b.y) {
    return -1;
  }
  if (a.y > b.y) {
    return 1;
  }

  if (a.z < b.z) {
    return -1;
  }
  if (a.z > b.z) {
    return 1;
  }

  // use the index as a final tie breaker
  if (a.index < b.index) {
    return -1;
  }
  if (a.index > b.index) {
    return 1;
  }

  return 0;
};

/**
 * Returns true if a is strictly less than b in x, otherwise false. See
 * `compareX_` for ordering details.
 * @param {IOWA.WebglGlobe.KdNode} a
 * @param {IOWA.WebglGlobe.KdNode} b
 * @return {boolean}
 * @private
 */
IOWA.WebglGlobe.KdTree.lessThanX_ = function(a, b) {
  return (a.x < b.x) ||
      (a.x === b.x && ((a.y < b.y) ||
      (a.y === b.y && ((a.z < b.z) ||
      (a.z === b.z && a.index < b.index)))));
};

/**
 * Comparator function for sorting KdData values in y. If two objects have the
 * same y value, they are sorted in z, and if equal there, by x, and if equal
 * there, by unique index.
 * @param {IOWA.WebglGlobe.KdNode} a
 * @param {IOWA.WebglGlobe.KdNode} b
 * @return {number}
 * @private
 */
IOWA.WebglGlobe.KdTree.compareY_ = function(a, b) {
  if (a.y < b.y) {
    return -1;
  }
  if (a.y > b.y) {
    return 1;
  }

  if (a.z < b.z) {
    return -1;
  }
  if (a.z > b.z) {
    return 1;
  }

  if (a.x < b.x) {
    return -1;
  }
  if (a.x > b.x) {
    return 1;
  }

  // use the index as a final tie breaker
  if (a.index < b.index) {
    return -1;
  }
  if (a.index > b.index) {
    return 1;
  }

  return 0;
};

/**
 * Returns true if a is strictly less than b in y, otherwise false. See
 * `compareY_` for ordering details.
 * @param {IOWA.WebglGlobe.KdNode} a
 * @param {IOWA.WebglGlobe.KdNode} b
 * @return {boolean}
 * @private
 */
IOWA.WebglGlobe.KdTree.lessThanY_ = function(a, b) {
  return (a.y < b.y) ||
      (a.y === b.y && ((a.z < b.z) ||
      (a.z === b.z && ((a.x < b.x) ||
      (a.x === b.x && a.index < b.index)))));
};

/**
 * Comparator function for sorting KdData values in z. If two objects have the
 * same z value, they are sorted in x, and if equal there, by y, and if equal
 * there, by unique index.
 * @param {IOWA.WebglGlobe.KdNode} a
 * @param {IOWA.WebglGlobe.KdNode} b
 * @return {number}
 * @private
 */
IOWA.WebglGlobe.KdTree.compareZ_ = function(a, b) {
  if (a.z < b.z) {
    return -1;
  }
  if (a.z > b.z) {
    return 1;
  }

  if (a.x < b.x) {
    return -1;
  }
  if (a.x > b.x) {
    return 1;
  }

  if (a.y < b.y) {
    return -1;
  }
  if (a.y > b.y) {
    return 1;
  }

  // use the index as a final tie breaker
  if (a.index < b.index) {
    return -1;
  }
  if (a.index > b.index) {
    return 1;
  }

  return 0;
};

/**
 * Returns true if a is strictly less than b in z, otherwise false. See
 * `compareZ_` for ordering details.
 * @param {IOWA.WebglGlobe.KdNode} a
 * @param {IOWA.WebglGlobe.KdNode} b
 * @return {boolean}
 * @private
 */
IOWA.WebglGlobe.KdTree.lessThanZ_ = function(a, b) {
  return (a.z < b.z) ||
      (a.z === b.z && ((a.x < b.x) ||
      (a.x === b.x && ((a.y < b.y) ||
      (a.y === b.y && a.index < b.index)))));
};

/**
 * Returns the integer (truncated) log base 2 of the integer v, aka the place of
 * the highest-order bit in v. Equivalent to Math.floor(Math.log2(v)). From
 * http://graphics.stanford.edu/~seander/bithacks.html#IntegerLog
 * @param {number} v
 * @return {number}
 * @private
 */
IOWA.WebglGlobe.KdTree.intLogBase2_ = function(v) {
  v = v | 0;
  var r = 0;
  if (v & 0xFFFF0000) {
    v >>= 16;
    r |= 16;
  }
  if (v & 0xFF00) {
    v >>= 8;
    r |= 8;
  }
  if (v & 0xF0) {
    v >>= 4;
    r |= 4;
  }
  if (v & 0xC) {
    v >>= 2;
    r |= 2;
  }
  if (v & 0x2) {
    r |= 1;
  }
  return r;
};

/**
 * For a given array length, find the split index that will produce a *complete*
 * binary tree when applied repeatedly to the resulting subarrays.
 * @param {number} length
 * @return {number}
 * @private
 */
IOWA.WebglGlobe.KdTree.arraySplit_ = function(length) {
  var treeHeight = IOWA.WebglGlobe.KdTree.intLogBase2_(length);
  var firstBit = 1 << treeHeight;
  var secondBit = 1 << (treeHeight - 1);

  // If the bottom level is more than half filled, split after left subtree of
  // height - 1; if less than half, split before a right subtree of height - 2.
  if (length & secondBit) {
    return firstBit - 1;
  }
  return length ^ firstBit | secondBit;
};

/**
 * Build a k-d tree from the provided arrays, sorted in each dimension.
 * @param {!Array<IOWA.WebglGlobe.KdNode>} sorted0 An array of points to put in
 *     the tree, sorted in the dimension indicated by the current depth.
 * @param {!Array<IOWA.WebglGlobe.KdNode>} sorted1 An array of the same points,
 *     sorted in a different dimension.
 * @param {!Array<IOWA.WebglGlobe.KdNode>} sorted2 An array of the same points,
 *     sorted in the final dimension.
 * @param {number} depth The current traversal depth within the tree.
 * @return {?IOWA.WebglGlobe.KdNode} The root of the tree at this level.
 * @private
 */
IOWA.WebglGlobe.KdTree.build_ = function(sorted0, sorted1, sorted2, depth) {
  // base cases
  if (sorted0.length === 1) {
    return sorted0[0];
  } else if (sorted0.length === 0) {
    return null;
  }

  var splitIndex = IOWA.WebglGlobe.KdTree.arraySplit_(sorted0.length);
  var splitNode = sorted0[splitIndex];
  var point, lessThan;

  // Divide this dimension's array to left and right of median.
  var left0 = [];
  var right0 = [];
  for (var i = 0; i < splitIndex; i++) {
    left0[i] = sorted0[i];
  }
  i++;
  for (; i < sorted0.length; i++) {
    right0.push(sorted0[i]);
  }

  var dimension = depth % 3;

  // Divide the next two dimensions' arrays into left and right arrays based on
  // *this* dimension's median.
  var left1 = [];
  var right1 = [];
  for (i = 0; i < sorted1.length; i++) {
    point = sorted1[i];
    if (point === splitNode) {
      continue;
    }

    if (dimension === 0) {
      lessThan = IOWA.WebglGlobe.KdTree.lessThanX_(point, splitNode);
    } else if (dimension === 1) {
      lessThan = IOWA.WebglGlobe.KdTree.lessThanY_(point, splitNode);
    } else {
      lessThan = IOWA.WebglGlobe.KdTree.lessThanZ_(point, splitNode);
    }
    if (lessThan) {
      left1.push(point);
    } else {
      right1.push(point);
    }
  }

  // Do the same for the final dimension.
  var left2 = [];
  var right2 = [];
  for (i = 0; i < sorted2.length; i++) {
    point = sorted2[i];
    if (point === splitNode) {
      continue;
    }

    if (dimension === 0) {
      lessThan = IOWA.WebglGlobe.KdTree.lessThanX_(point, splitNode);
    } else if (dimension === 1) {
      lessThan = IOWA.WebglGlobe.KdTree.lessThanY_(point, splitNode);
    } else {
      lessThan = IOWA.WebglGlobe.KdTree.lessThanZ_(point, splitNode);
    }
    if (lessThan) {
      left2.push(point);
    } else {
      right2.push(point);
    }
  }

  // Shuffle to the next dimension and recurse.
  splitNode.left = IOWA.WebglGlobe.KdTree.build_(left1, left2, left0,
      depth + 1);
  splitNode.right = IOWA.WebglGlobe.KdTree.build_(right1, right2, right0,
      depth + 1);

  return splitNode;
};

/**
 * A lazy way to create a flat-array representation of the tree instead of
 * during construction.
 * @param {!IOWA.WebglGlobe.KdNode} current The current root node of the traversal.
 * @param {number} currentIndex The current node's index in store.
 * @param {!Float64Array} store The backing array for tree storage.
 * @return {!Float64Array}
 */
IOWA.WebglGlobe.KdTree.buildFlatStore_ = function(current, currentIndex, store) {
  store[currentIndex] = current.index;
  store[currentIndex + 1] = current.x;
  store[currentIndex + 2] = current.y;
  store[currentIndex + 3] = current.z;

  currentIndex /= 4;
  if (current.left) {
    IOWA.WebglGlobe.KdTree.buildFlatStore_(current.left,
        (2 * currentIndex + 1) * 4, store);

    if (current.right) {
      IOWA.WebglGlobe.KdTree.buildFlatStore_(current.right,
          (2 * currentIndex + 2) * 4, store);
    }
  }

  return store;
};

/**
 * Returns the index of the nearest node in the tree to the target coordinates,
 * as defined by comparator sorting, within a bounding sphere of radius
 * maxDistance. If no suitable node is found, an index of -1 is returned. To
 * search regardless of distance, a maxDistance of Number.MAX_VALUE or Infinity
 * may be used.
 * @param {number} targetX
 * @param {number} targetY
 * @param {number} targetZ
 * @param {number} maxDistance
 * @return {number}
 * @private
 */
IOWA.WebglGlobe.KdTree.prototype.nearest_ = function(targetX, targetY, targetZ, maxDistance) {
  var candidateIndex = -1;
  var candidateSqDistance = maxDistance * maxDistance;
  var treeStore = this.store_;
  var indexStack = this.indexStack_;
  var sqDistanceStack = this.distanceStack_;

  var stackPointer = 0;
  var current = 0;
  var depth = 0;

  do {
    // When a leaf node is reached, pop the next node off the stack instead.
    if (current >= treeStore.length) {
      depth = stackPointer;
      stackPointer--;
      var testSqDistance = sqDistanceStack[stackPointer];
      // Ignore new node if distance to its side of split is larger than current
      // search distance.
      if (testSqDistance <= candidateSqDistance && indexStack[stackPointer] < treeStore.length) {
        current = indexStack[stackPointer];
      } else {
        continue;
      }
    }

    var xDiff = targetX - treeStore[current + 1];
    var yDiff = targetY - treeStore[current + 2];
    var zDiff = targetZ - treeStore[current + 3];

    // Use current as the new candidate if it is closer to the target.
    var sqDistance = xDiff * xDiff + yDiff * yDiff + zDiff * zDiff;
    if (sqDistance < candidateSqDistance) {
      candidateSqDistance = sqDistance;
      candidateIndex = current;
    }

    // Don't attempt to visit children if we're already at a leaf.
    var baseIndex = current << 1;
    if (baseIndex + 4 < treeStore.length) {
      // Visit children, prioritizing the side of the split target is in.
      var dimension = (depth % 3) | 0;
      var testDistance;
      if (dimension === 0) {
        testDistance = xDiff;
      } else if (dimension === 1) {
        testDistance = yDiff;
      } else {
        testDistance = zDiff;
      }
      // "Left" (< 0) is at baseIndex + 4, "right" (>= 0) is at baseIndex + 8.
      var firstOffset = testDistance < 0 ? 4 : 8;
      var firstIndex = baseIndex + firstOffset;
      var secondIndex = baseIndex + (firstOffset ^ 12);

      // Push the other child on the node stack.
      indexStack[stackPointer] = secondIndex;
      sqDistanceStack[stackPointer] = testDistance * testDistance;
      stackPointer++;

      // Start anew with the first child.
      current = firstIndex;
      depth++;
    } else {
      // At a leaf; use an invalid index so next node will be from the stack.
      current = baseIndex + 4;
    }
  } while (stackPointer > 0);

  return candidateIndex < 0 ? candidateIndex : treeStore[candidateIndex];
};

/**
 * Find the points within a specified distance from the target coordinates. If
 * none are found, an empty array is returned. A second array,
 * opt_sqDistancesArray, may be provided to store the square of the distances
 * from the target to the found points. It may be reused repeatedly, but will
 * not be cleared first, so only the first n entries will be valid, where n is
 * the number of entries in the returned neighbors array.
 * @param {number} targetX
 * @param {number} targetY
 * @param {number} targetZ
 * @param {number} targetDistance The distance in which to search for neighbors.
 * @param {Array<number>=} opt_sqDistancesArray
 * @return {!Array<number>}
 * @private
 */
IOWA.WebglGlobe.KdTree.prototype.neighborhood_ = function(targetX, targetY, targetZ, targetDistance, opt_sqDistancesArray) {
  var neighbors = [];
  var targetSqDistance = targetDistance * targetDistance;
  var treeStore = this.store_;
  var indexStack = this.indexStack_;
  var sqDistanceStack = this.distanceStack_;

  var stackPointer = 0;
  var current = 0;
  var depth = 0;

  var storeDistances = (opt_sqDistancesArray != null);

  do {
    // When a leaf node is reached, pop the next node off the stack instead.
    if (current >= treeStore.length) {
      depth = stackPointer;
      stackPointer--;
      var testSqDistance = sqDistanceStack[stackPointer];
      // Ignore new node if distance to its side of split is larger than search
      // distance.
      if (testSqDistance <= targetSqDistance && indexStack[stackPointer] < treeStore.length) {
        current = indexStack[stackPointer];
      } else {
        continue;
      }
    }

    var xDiff = targetX - treeStore[current + 1];
    var yDiff = targetY - treeStore[current + 2];
    var zDiff = targetZ - treeStore[current + 3];

    // Add current to neighbors if it is wthin distance bounds of target.
    var sqDistance = xDiff * xDiff + yDiff * yDiff + zDiff * zDiff;
    if (sqDistance < targetSqDistance) {
      if (storeDistances) {
        opt_sqDistancesArray[neighbors.length] = sqDistance;
      }
      neighbors.push(current);
    }

    // Don't attempt to visit children if we're already at a leaf.
    var baseIndex = current << 1;
    if (baseIndex + 4 < treeStore.length) {
      // Visit children, prioritizing the side of the split target is in.
      var dimension = (depth % 3) | 0;
      var testDistance;
      if (dimension === 0) {
        testDistance = xDiff;
      } else if (dimension === 1) {
        testDistance = yDiff;
      } else {
        testDistance = zDiff;
      }
      // "Left" (< 0) is at baseIndex + 4, "right" (>= 0) is at baseIndex + 8.
      var firstOffset = testDistance < 0 ? 4 : 8;
      var firstIndex = baseIndex + firstOffset;
      var secondIndex = baseIndex + (firstOffset ^ 12);

      // Push the other child on the node stack.
      indexStack[stackPointer] = secondIndex;
      sqDistanceStack[stackPointer] = testDistance * testDistance;
      stackPointer++;

      // Start anew with the first child.
      current = firstIndex;
      depth++;
    } else {
      // At a leaf; use an invalid index so next node will be from the stack.
      current = baseIndex + 4;
    }
  } while (stackPointer > 0);

  return neighbors;
};

/**
 * Finds the nearest neighbor to the specified coordinates and returns the index
 * of that neighbor in the original point array. An optional maximum distance
 * can be specified, which will ignore any points beyond that distance. An index
 * of -1 will be returned if no point is found.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number=} opt_maxDistance
 * @return {number}
 */
IOWA.WebglGlobe.KdTree.prototype.nearestNeighbor = function(x, y, z, opt_maxDistance) {
  var distance = (opt_maxDistance == null) ? Number.MAX_VALUE : opt_maxDistance;
  var result = this.nearest_(x, y, z, distance);

  return result;
};

/**
 * A convenience method to call `nearestNeighbor` but with latitude and
 * longitude instead of a three-dimensional coordinate.
 * @param {number} lat
 * @param {number} lng
 * @param {number=} opt_maxDistance
 * @return {number}
 */
IOWA.WebglGlobe.KdTree.prototype.nearestNeighborByLatLng = function(lat, lng, opt_maxDistance) {
  var radLat = lat * (Math.PI / 180);
  var radLng = lng * (Math.PI / 180);
  var cosLat = Math.cos(radLat);
  var x = Math.sin(radLng) * cosLat;
  var y = Math.sin(radLat);
  var z = Math.cos(radLng) * cosLat;

  return this.nearestNeighbor(x, y, z, opt_maxDistance);
};

/**
 * Find all points within maxDistance radius of the target latitude and
 * longitude. Returns an empty array if none are found.
 * @param {number} lat
 * @param {number} lng
 * @param {number} maxDistance
 * @return {!Array<number>}
 */
IOWA.WebglGlobe.KdTree.prototype.nearestNeighborsByLatLng = function(lat, lng, maxDistance) {
  var radLat = lat * (Math.PI / 180);
  var radLng = lng * (Math.PI / 180);
  var cosLat = Math.cos(radLat);

  var x = Math.sin(radLng) * cosLat;
  var y = Math.sin(radLat);
  var z = Math.cos(radLng) * cosLat;

  var sqDistancesArray = [];
  var neighbors = this.neighborhood_(x, y, z, maxDistance, sqDistancesArray);

  // Sort by distance.
  neighbors.sort(function(a, b) {
    return sqDistancesArray[a] - sqDistancesArray[b];
  });

  // Replace internal indices with indices into original points array.
  for (var i = 0; i < neighbors.length; i++) {
    neighbors[i] = this.store_[neighbors[i]];
  }

  return neighbors;
};
