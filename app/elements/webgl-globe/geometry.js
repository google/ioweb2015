/* global IOWA */

/**
 * Generates a vertex and index array describing a sphere created by subdividing
 * the edges of an icosahedron into `divisions` number of segments. With current
 * triangle setup, 80 is the max divisions supported by Uint16Array indices.
 * @param {number} divisions
 * @return {!Float32Array}
 */
IOWA.webglGlobe.generateGeometry = (function() {
  'use strict';

  // attribute components per vertex
  var SIZE = 4;

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
   * Linearly interpolate a vector of SIZE components between from (at
   * fromIndex) and to (at toIndex) at t. Result put in dest (at destIndex).
   * @param {!Float32Array} dest
   * @param {number} destIndex
   * @param {!Float32Array} from
   * @param {number} fromIndex
   * @param {!Float32Array} to
   * @param {number} toIndex
   * @param {number} t
   */
  function lerpVert(dest, destIndex, from, fromIndex, to, toIndex, t) {
    for (var i = 0; i < SIZE; i++) {
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
    var geometryArray = new Float32Array(vertCount * SIZE);

    // temp coordinate buffers for interpolation end points
    var left = new Float32Array(SIZE);
    var mid = new Float32Array(SIZE);
    var right = new Float32Array(SIZE);

    // current pointer into geometry array
    var geomCursor = 0;

    // generate five sets of faces
    for (var i = 0; i < 5; i++) {
      // indices of corners of top pair of faces in array CORNERS
      // slightly insane values here just a result of ordering of CORNERS and
      // topology of icosahedron. There may be a simpler ordering.
      var topLeft = 0;
      var topRight = ((i + 1) % 5 + 1) * SIZE;
      var bottomLeft = (i + 1) * SIZE;
      var bottomRight = ((i + 1) % 5 + 6) * SIZE;

      // first line of verts gets its very own loop to avoid some singularities
      var u;
      for (var ui = 0; ui < divisions + 1; ui++) {
        u = ui / divisions;
        lerpVert(geometryArray, geomCursor * SIZE, CORNERS, topLeft, CORNERS,
            topRight, u);
        geomCursor++;
      }

      // two or more, use a for
      for (var j = 0; j < 2; j++) {
        for (var vi = 1; vi < divisions + 1; vi++) {
          var v = vi / divisions;
          lerpVert(left, 0, CORNERS, topLeft, CORNERS, bottomLeft, v);
          lerpVert(mid, 0, CORNERS, topRight, CORNERS, bottomLeft, v);
          lerpVert(right, 0, CORNERS, topRight, CORNERS, bottomRight, v);

          for (ui = 0; ui < divisions - vi; ui++) {
            u = ui / (divisions - vi);
            lerpVert(geometryArray, geomCursor * SIZE, left, 0, mid, 0, u);
            geomCursor++;
          }
          for (ui = 0; ui < vi + 1; ui++) {
            u = ui / vi;
            lerpVert(geometryArray, geomCursor * SIZE, mid, 0, right, 0, u);
            geomCursor++;
          }
        }

        // switch to corners of bottom pair of faces
        topLeft = bottomLeft;
        topRight = bottomRight;
        bottomLeft = (i + 6) * SIZE;
        bottomRight = 11 * SIZE;
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
IOWA.webglGlobe.generateIndexArray = function(divisions) {
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
