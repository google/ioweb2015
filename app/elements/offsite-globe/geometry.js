/* global IOWA */

/**
 * Generates a vertex and index array describing a sphere created by subdividing
 * the edges of an icosahedron into `divisions` number of segments.
 * @param {number} divisions
 * @return {{geometryArray: Float32Array, indexArray: Uint16Array}}
 */
IOWA.OffsiteGlobe.generateIcosphere = (function() {
  'use strict';

  // normalized coordinates of icosahedron vertices, all of which lie in the x-,
  // y-, or z-planes.
  var SHORT_DIM = Math.sqrt((5 - Math.sqrt(5)) / 10);
  var LONG_DIM = Math.sqrt((5 + Math.sqrt(5)) / 10);

  // attribute components per vertex
  var SIZE = 4;

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

  // TODO(bckenny): may want to special-case t=0 and t=1 in case of floating
  // point issues
  function lerp(a, b, t) {
    return a + t * (b - a);
  }

  function lerp4(dest, destIndex, a, aIndex, b, bIndex, t) {
    for (var i = 0; i < 4; i++) {
      dest[destIndex + i] = lerp(a[aIndex + i], b[bIndex + i], t);
    }
  }

  function generateGridIndices(indexArray, startIndex, geomIndex, triangleWidth) {
    var indicesIndex = startIndex;
    var vertexWidth = triangleWidth + 1;

    for (var y = 0; y < triangleWidth; y++) {
      for (var x = 0; x < triangleWidth; x++) {
        var y1 = y + 1;
        var x1 = x + 1;
        indexArray[indicesIndex++] = (geomIndex + y * vertexWidth + x);
        indexArray[indicesIndex++] = (geomIndex + y1 * vertexWidth + x);
        indexArray[indicesIndex++] = (geomIndex + y * vertexWidth + x1);

        indexArray[indicesIndex++] = (geomIndex + y * vertexWidth + x1);
        indexArray[indicesIndex++] = (geomIndex + y1 * vertexWidth + x);
        indexArray[indicesIndex++] = (geomIndex + y1 * vertexWidth + x1);
      }
    }

    return indicesIndex;
  }

  function generateIcosphere(divisions) {
    divisions = Math.max(1, divisions);

    // 2n^2 + 3n + 1 vertices for each of five columns of four faces each
    // don't share verts between columns as it buys very little for a lot of pain
    var vertCount = 5 * ((2 * divisions + 3) * divisions + 1);
    var geom = new Float32Array(vertCount * 5 * SIZE);

    // divisions^2 triangles per 20 faces
    var indices = new Uint16Array(20 * 3 * divisions * divisions);

    var left = new Float32Array(4);
    var mid = new Float32Array(4);
    var right = new Float32Array(4);

    // current pointers into geometry and index arrays
    var geomIndex = 0;
    var indicesIndex = 0;

    for (var i = 0; i < 5; i++) {
      var startGeomIndex = geomIndex;

    // first pair of faces
    var topLeft = 0;
    var topRight = ((i + 1) % 5 + 1) * SIZE;
    var bottomLeft = (i + 1) * SIZE;
    var bottomRight = ((i + 1) % 5 + 6) * SIZE;

    var v, ui, u;
    for (var vi = 0; vi < (divisions + 1); vi++) {
      v = vi / divisions;
      lerp4(left, 0, CORNERS, topLeft, CORNERS, bottomLeft, v);
      lerp4(mid, 0, CORNERS, topRight, CORNERS, bottomLeft, v);
      lerp4(right, 0, CORNERS, topRight, CORNERS, bottomRight, v);

      for (ui = 0; ui < divisions - vi; ui++) {
        u = ui / (divisions - vi);
        lerp4(geom, geomIndex * SIZE, left, 0, mid, 0, u);
        geomIndex++;
      }
      for (ui = 0; ui < vi + 1; ui++) {
        // TODO(bckenny): not wild about this, but technically correct because
        // parameter is undefined here. Find a way to rearrange
        u = ui === 0 ? 0 : ui / vi;
        lerp4(geom, geomIndex * SIZE, mid, 0, right, 0, u);
        geomIndex++;
      }
    }

    // second pair of faces
    topLeft = bottomLeft;
    topRight = bottomRight;
    bottomLeft = (i + 6) * SIZE;
    bottomRight = 11 * SIZE;

    // TODO(bckenny): skip the first row (already in place)
    for (vi = 1; vi < (divisions + 1); vi++) {
      v = vi / divisions;
      lerp4(left, 0, CORNERS, topLeft, CORNERS, bottomLeft, v);
      lerp4(mid, 0, CORNERS, topRight, CORNERS, bottomLeft, v);
      lerp4(right, 0, CORNERS, topRight, CORNERS, bottomRight, v);

      for (ui = 0; ui < divisions - vi; ui++) {
        u = ui / (divisions - vi);
        lerp4(geom, geomIndex * SIZE, left, 0, mid, 0, u);
        geomIndex++;
      }
      for (ui = 0; ui < vi + 1; ui++) {
        // don't need guard here since skip the first vi
        u = ui / vi;
        lerp4(geom, geomIndex * SIZE, mid, 0, right, 0, u);
        geomIndex++;
      }
    }

    indicesIndex = generateGridIndices(indices, indicesIndex,
        startGeomIndex, divisions);
    indicesIndex = generateGridIndices(indices, indicesIndex,
        startGeomIndex + divisions * (divisions + 1), divisions);
    }

    return {
      geometryArray: geom,
      indexArray: indices
    };
  }

  return generateIcosphere;
})();
