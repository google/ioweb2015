/* global IOWA */

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

/**
 * Generates a vertex and index array describing a sphere created by subdividing
 * the edges of an icosahedron into `divisions` number of segments. With current
 * triangle setup, 80 is the max divisions supported by Uint16Array indices.
 * @param {number} divisions
 * @return {!Float32Array}
 */
IOWA.WebglGlobe.generateGeometry = (function() {
  'use strict';

  /**
   * Attribute components per vertex.
   * @private {number}
   */
  var COMPONENTS_PER_VERTEX_ = 4;

  // normalized coordinates of icosahedron vertices, all of which lie soley in
  // the x-, y-, or z-planes.
  var SHORT_DIM = Math.sqrt((5 - Math.sqrt(5)) / 10);
  var LONG_DIM = Math.sqrt((5 + Math.sqrt(5)) / 10);

  var CORNERS = [
    SHORT_DIM, 0, LONG_DIM, 1,

    0, LONG_DIM, SHORT_DIM, 1,
    -SHORT_DIM, 0, LONG_DIM, 1,
    0, -LONG_DIM, SHORT_DIM, 1,
    LONG_DIM, -SHORT_DIM, 0, 1,
    LONG_DIM, SHORT_DIM, 0, 1,

    0, LONG_DIM, -SHORT_DIM, 1,
    -LONG_DIM, SHORT_DIM, 0, 1,
    -LONG_DIM, -SHORT_DIM, 0, 1,
    0, -LONG_DIM, -SHORT_DIM, 1,
    SHORT_DIM, 0, -LONG_DIM, 1,

    -SHORT_DIM, 0, -LONG_DIM, 1
  ];

  /**
   * Linearly interpolate a vector of COMPONENTS_PER_VERTEX_ components between
   * `from` (at `fromIndex`) and `to` (at `toIndex`) at interpolation parameter
   * `t`. Result put in `dest` (at `destIndex`).
   * @param {!Float32Array} dest
   * @param {number} destIndex
   * @param {!Float32Array} from
   * @param {number} fromIndex
   * @param {!Float32Array} to
   * @param {number} toIndex
   * @param {number} t
   */
  function lerpVert(dest, destIndex, from, fromIndex, to, toIndex, t) {
    for (var i = 0; i < COMPONENTS_PER_VERTEX_; i++) {
      var a = from[fromIndex + i];
      var b = to[toIndex + i];
      // TODO(bckenny): may want to special-case t=0 and t=1 in case of floating
      // point issues
      dest[destIndex + i] =  a + t * (b - a);
    }
  }

  return function generateGeometry(divisions) {
    divisions = Math.max(1, divisions);

    // 2n^2 + 3n + 1 vertices for each of five columns of four faces each
    // don't share verts between columns as it buys little memory savings and
    // a slim chance of hitting the cache but pays with loss of coherency
    var vertCount = 5 * ((2 * divisions + 3) * divisions + 1);
    var geometryArray = new Float32Array(vertCount * COMPONENTS_PER_VERTEX_);

    // temp coordinate buffers for interpolation end points
    var left = new Float32Array(COMPONENTS_PER_VERTEX_);
    var mid = new Float32Array(COMPONENTS_PER_VERTEX_);
    var right = new Float32Array(COMPONENTS_PER_VERTEX_);

    // current pointer into geometry array
    var geomCursor = 0;

    // generate five sets of faces
    for (var i = 0; i < 5; i++) {
      // indices (into array CORNERS) of corners of top pair of faces
      // slightly insane values here just a result of ordering of CORNERS and
      // topology of icosahedron. There may be a simpler ordering.
      var topLeft = 0;
      var topRight = ((i + 1) % 5 + 1) * COMPONENTS_PER_VERTEX_;
      var bottomLeft = (i + 1) * COMPONENTS_PER_VERTEX_;
      var bottomRight = ((i + 1) % 5 + 6) * COMPONENTS_PER_VERTEX_;

      // first line of verts gets its very own loop to avoid division by zero
      // when looping over rows in inner loop, below
      var u;
      for (var ui = 0; ui < divisions + 1; ui++) {
        u = ui / divisions;
        lerpVert(geometryArray, geomCursor * COMPONENTS_PER_VERTEX_, CORNERS, topLeft, CORNERS,
            topRight, u);
        geomCursor++;
      }

      // two or more, use a for
      for (var j = 0; j < 2; j++) {
        // loop over rows of vertices
        for (var vi = 1; vi < divisions + 1; vi++) {
          var v = vi / divisions;
          lerpVert(left, 0, CORNERS, topLeft, CORNERS, bottomLeft, v);
          lerpVert(mid, 0, CORNERS, topRight, CORNERS, bottomLeft, v);
          lerpVert(right, 0, CORNERS, topRight, CORNERS, bottomRight, v);

          // each row of vertices is divided into a left and right triangle,
          // each with its own loop here. The left triangle goes from `left` to
          // `mid`, while the right goes from `mid` to `right`.
          for (ui = 0; ui < divisions - vi; ui++) {
            u = ui / (divisions - vi);
            lerpVert(geometryArray, geomCursor * COMPONENTS_PER_VERTEX_, left, 0,
                mid, 0, u);
            geomCursor++;
          }
          for (ui = 0; ui < vi + 1; ui++) {
            u = ui / vi;
            lerpVert(geometryArray, geomCursor * COMPONENTS_PER_VERTEX_, mid, 0,
                right, 0, u);
            geomCursor++;
          }
        }

        // switch to corners of bottom pair of faces
        topLeft = bottomLeft;
        topRight = bottomRight;
        bottomLeft = (i + 6) * COMPONENTS_PER_VERTEX_;
        bottomRight = 11 * COMPONENTS_PER_VERTEX_;
      }
    }

    return geometryArray;
  };
})();

/**
 * Generates an index array describing a sphere created by subdividing the
 * edges of an icosahedron into `divisions` number of segments. With current
 * triangle setup, 80 is the max divisions supported by Uint16Array indices.
 * @param {number} divisions
 * @return {!Uint16Array}
 */
IOWA.WebglGlobe.generateIndexArray = function(divisions) {
  'use strict';

  divisions = Math.max(1, divisions);

  // 20 faces divided into (divisions^2) triangles, each with 3 vertices
  var indexArray = new Uint16Array(20 * divisions * divisions * 3);
  var indexCursor = 0;

  var vertsPerGroup = (2 * divisions + 3) * divisions + 1;
  var vertsPerRow = divisions + 1;

  // as in generateGeometry, triangles in five groups of four connected faces
  for (var i = 0; i < 5; i++) {
    var groupStart = vertsPerGroup * i;
    for (var y = 0; y < divisions * 2; y++) {
      for (var x = 0; x < divisions; x++) {
        var y1 = y + 1;
        var x1 = x + 1;

        // |‾/
        // |/
        indexArray[indexCursor++] = (groupStart + y * vertsPerRow + x);
        indexArray[indexCursor++] = (groupStart + y1 * vertsPerRow + x);
        indexArray[indexCursor++] = (groupStart + y * vertsPerRow + x1);

        //  /|
        // /_|
        indexArray[indexCursor++] = (groupStart + y * vertsPerRow + x1);
        indexArray[indexCursor++] = (groupStart + y1 * vertsPerRow + x);
        indexArray[indexCursor++] = (groupStart + y1 * vertsPerRow + x1);
      }
    }
  }

  return indexArray;
};
