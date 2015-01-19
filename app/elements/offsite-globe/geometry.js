IOWA.OffsiteGlobe.generateGeometry = (function() {
  'use strict';

  // normalized coordinates of icosahedron vertices, all of which lie in the x-,
  // y-, or z-planes.
  var SHORT_DIM = Math.sqrt((5 - Math.sqrt(5)) / 10);
  var LONG_DIM = Math.sqrt((5 + Math.sqrt(5)) / 10);

  var CORNERS = [
    SHORT_DIM, 0, LONG_DIM, 1,
    -SHORT_DIM, 0, LONG_DIM, 1,
    0, LONG_DIM, SHORT_DIM, 1,
    LONG_DIM, SHORT_DIM, 0, 1,
    LONG_DIM, -SHORT_DIM, 0, 1,
    0, -LONG_DIM, SHORT_DIM, 1,

    0, -LONG_DIM, -SHORT_DIM, 1,
    -LONG_DIM, -SHORT_DIM, 0, 1,
    -LONG_DIM, SHORT_DIM, 0, 1,
    0, LONG_DIM, -SHORT_DIM, 1,
    SHORT_DIM, 0, -LONG_DIM, 1,
    -SHORT_DIM, 0, -LONG_DIM, 1,

    // LONG_DIM, SHORT_DIM, 0, 1,
    // -LONG_DIM, SHORT_DIM, 0, 1,
    // LONG_DIM, -SHORT_DIM, 0, 1,
    // -LONG_DIM, -SHORT_DIM, 0, 1,

    // SHORT_DIM, 0, LONG_DIM, 1,
    // SHORT_DIM, 0, -LONG_DIM, 1,
    // -SHORT_DIM, 0, LONG_DIM, 1,
    // -SHORT_DIM, 0, -LONG_DIM, 1,

    // 0, LONG_DIM, SHORT_DIM, 1,
    // 0, -LONG_DIM, SHORT_DIM, 1,
    // 0, LONG_DIM, -SHORT_DIM, 1,
    // 0, -LONG_DIM, -SHORT_DIM, 1
  ];

  function generateGeometry() {
    return {
      geometryArray: new Float32Array(CORNERS),
      indexArray: new Uint16Array([
        // top
        0, 2, 1,
        0, 3, 2,
        0, 4, 3,
        0, 5, 4,
        0, 1, 5,

        5, 1, 7,
        1, 8, 7,
        1, 2, 8,

        8, 2, 9,

        2, 3, 9,
        3, 10, 9,
        3, 4, 10,

        10, 4, 6,

        4, 5, 6,
        5, 7, 6,

        // bottom
        6, 7, 11,
        7, 8, 11,
        8, 9, 11,
        9, 10, 11,
        10, 6, 11
      ])
    };
  }

  return generateGeometry;
})();
