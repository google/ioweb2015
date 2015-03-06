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

  /**
   * The root of the tree.
   * @private {IOWA.WebglGlobe.KdNode}
   */
  this.root_ = IOWA.WebglGlobe.KdTree.build_(xsorted, ysorted, zsorted, 0);
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

  var medianIndex = (sorted0.length / 2) | 0;
  var medianNode = sorted0[medianIndex];
  var point, lessThan;

  // Divide this dimension's array to left and right of median.
  var left0 = [];
  var right0 = [];
  for (var i = 0; i < medianIndex; i++) {
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
    if (point === medianNode) {
      continue;
    }

    if (dimension === 0) {
      lessThan = IOWA.WebglGlobe.KdTree.lessThanX_(point, medianNode);
    } else if (dimension === 1) {
      lessThan = IOWA.WebglGlobe.KdTree.lessThanY_(point, medianNode);
    } else {
      lessThan = IOWA.WebglGlobe.KdTree.lessThanZ_(point, medianNode);
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
    if (point === medianNode) {
      continue;
    }

    if (dimension === 0) {
      lessThan = IOWA.WebglGlobe.KdTree.lessThanX_(point, medianNode);
    } else if (dimension === 1) {
      lessThan = IOWA.WebglGlobe.KdTree.lessThanY_(point, medianNode);
    } else {
      lessThan = IOWA.WebglGlobe.KdTree.lessThanZ_(point, medianNode);
    }
    if (lessThan) {
      left2.push(point);
    } else {
      right2.push(point);
    }
  }

  // Shuffle to the next dimension and recurse.
  medianNode.left = IOWA.WebglGlobe.KdTree.build_(left1, left2, left0,
      depth + 1);
  medianNode.right = IOWA.WebglGlobe.KdTree.build_(right1, right2, right0,
      depth + 1);

  return medianNode;
};

/**
 * Find the nearest value in the tree to target, as defined by comparator
 * sorting.
 * @param {{x: number, y: number, z: number}} target
 * @param {IOWA.WebglGlobe.KdNode} current The current root node of the search.
 * @param {number} depth The current traversal depth within the tree.
 * @param {{neighbor: ?IOWA.WebglGlobe.KdNode, sqDistance: number}} candidate
 * @return {{neighbor: ?IOWA.WebglGlobe.KdNode, sqDistance: number}}
 * @private
 */
IOWA.WebglGlobe.KdTree.nearest_ = function(target, current, depth, candidate) {
  var xDiff = target.x - current.x;
  var yDiff = target.y - current.y;
  var zDiff = target.z - current.z;
  xDiff *= xDiff;
  yDiff *= yDiff;
  zDiff *= zDiff;

  // Test if current is closer than the current candidate.
  var sqDistance = xDiff + yDiff + zDiff;
  if (sqDistance < candidate.sqDistance) {
    candidate.sqDistance = sqDistance;
    candidate.neighbor = current;
  }

  // Determine which side of split in current dimension that target is in.
  var leftFirst;
  var testSqDistance;
  var dimension = depth % 3;
  if (dimension === 0) {
    leftFirst = target.x < current.x;
    testSqDistance = xDiff;
  } else if (dimension === 1) {
    leftFirst = target.y < current.y;
    testSqDistance = yDiff;
  } else {
    leftFirst = target.z < current.z;
    testSqDistance = zDiff;
  }

  // Recurse to children, prioritizing the side of the split target is in.
  var first = leftFirst ? current.left : current.right;
  var second = leftFirst ? current.right : current.left;
  if (first !== null) {
    candidate = IOWA.WebglGlobe.KdTree.nearest_(target, first, depth + 1,
        candidate);
  }
  // Don't visit the other side of the split if farther away than candidate.
  if (testSqDistance <= candidate.sqDistance && second !== null) {
    candidate = IOWA.WebglGlobe.KdTree.nearest_(target, second, depth + 1,
        candidate);
  }

  return candidate;
};

/**
 * Find the points within a specified distance from target location.
 * @param {{x: number, y: number, z: number, sqDistance: number}} target
 * @param {IOWA.WebglGlobe.KdNode} current The current root node of the search.
 * @param {number} depth The current traversal depth within the tree.
 * @param {!Array<{neighbor: ?IOWA.WebglGlobe.KdNode, sqDistance: number}>} neighbors
 * @return {!Array<{neighbor: ?IOWA.WebglGlobe.KdNode, sqDistance: number}>}
 * @private
 */
IOWA.WebglGlobe.KdTree.neighborhood_ = function(target, current, depth, neighbors) {
  var xDiff = target.x - current.x;
  var yDiff = target.y - current.y;
  var zDiff = target.z - current.z;
  xDiff *= xDiff;
  yDiff *= yDiff;
  zDiff *= zDiff;

  // Test if current is wthin distance bounds.
  var sqDistance = xDiff + yDiff + zDiff;
  if (sqDistance < target.sqDistance) {
    neighbors.push({
      neighbor: current,
      sqDistance: sqDistance
    });
  }

  // Determine which side of split in current dimension that target is in.
  var leftFirst;
  var testSqDistance;
  var dimension = depth % 3;
  if (dimension === 0) {
    leftFirst = target.x < current.x;
    testSqDistance = xDiff;
  } else if (dimension === 1) {
    leftFirst = target.y < current.y;
    testSqDistance = yDiff;
  } else {
    leftFirst = target.z < current.z;
    testSqDistance = zDiff;
  }

  // Recurse to children, prioritizing the side of the split target is in.
  var first = leftFirst ? current.left : current.right;
  var second = leftFirst ? current.right : current.left;
  if (first !== null) {
    neighbors = IOWA.WebglGlobe.KdTree.neighborhood_(target, first, depth + 1,
        neighbors);
  }
  // Don't visit the other side of the split if farther away than limit.
  if (testSqDistance <= target.sqDistance && second !== null) {
    neighbors = IOWA.WebglGlobe.KdTree.nearest_(target, second, depth + 1,
        neighbors);
  }

  return neighbors;
};

/**
 * Finds the nearest neighbor to the specified coordinates and returns an object
 * with the index of that neighbor in the original point array along with the
 * distance from that neighbor to the target point. The distance is the chord
 * length between those points; the angular distance (assuming a unit sphere)
 * would be 2 * Math.asin(distance / 2).
 * An optional maximum distance can be specified, which will ignore any points
 * beyond that distance. An index of -1 will be returned if no point is found.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number=} opt_maxDistance
 * @return {{index: number, distance: number}}
 */
IOWA.WebglGlobe.KdTree.prototype.nearestNeighbor = function(x, y, z, opt_maxDistance) {
  var searchPoint = {
    x: x,
    y: y,
    z: z
  };

  var result = {
    neighbor: null,
    sqDistance: opt_maxDistance == null ? Number.MAX_VALUE :
        opt_maxDistance * opt_maxDistance
  };
  result = IOWA.WebglGlobe.KdTree.nearest_(searchPoint, this.root_, 0, result);

  return {
    index: result.neighbor ? result.neighbor.index : -1,
    distance: Math.sqrt(result.sqDistance)
  };
};

/**
 * A convenience method to call `nearestNeighbor` but with latitude and
 * longitude instead of a three-dimensional coordinate.
 * @param {number} lat
 * @param {number} lng
 * @param {numebr=} opt_maxDistance
 * @return {{index: number, distance: number}}
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
 * @param {numebr} maxDistance
 * @return {!Array<{index: number, distance: number}>}
 */
IOWA.WebglGlobe.KdTree.prototype.nearestNeighborsByLatLng = function(lat, lng, maxDistance) {
  var radLat = lat * (Math.PI / 180);
  var radLng = lng * (Math.PI / 180);
  var cosLat = Math.cos(radLat);

  var searchPoint = {
    x: Math.sin(radLng) * cosLat,
    y: Math.sin(radLat),
    z: Math.cos(radLng) * cosLat,
    sqDistance: maxDistance * maxDistance
  };

  var neighbors = IOWA.WebglGlobe.KdTree.neighborhood_(searchPoint, this.root_,
      0, []);
  var results = [];
  for (var i = 0; i < neighbors.length; i++) {
    results[i] = {
      index: neighbors[i].neighbor.index,
      distance: Math.sqrt(neighbors[i].sqDistance)
    };
  }

  results.sort(function(a, b) { return a.distance - b.distance; });

  return results;
};
