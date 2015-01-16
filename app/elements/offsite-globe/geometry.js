IOWA.OffsiteGlobe.generateGeometry = (function() {
  'use strict';

  var CORNERS = [
    0, 1, 0, 1,
    0, 0, 0, 1,
    1, 1, 0, 1,
    1, 0, 0, 1,
    1, 1, -1, 1,
    1, 0, -1, 1,
    0, 1, -1, 1,
    0, 0, -1, 1,
  ];

  function generateGeometry() {
    return {
      geometryArray: new Float32Array(CORNERS),
      indexArray: new Uint16Array([
        0, 1, 2,
        2, 1, 3,
        2, 3, 4,
        4, 3, 5,
        4, 5, 6,
        6, 5, 7,
        6, 7, 0,
        0, 7, 1,

        // top
        6, 0, 4,
        4, 0, 2,

        // bottom
        1, 7, 3,
        3, 7, 5
      ])
    };
  }

  return generateGeometry;
})();
