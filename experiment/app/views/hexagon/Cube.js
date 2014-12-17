module.exports = (function() {
  'use strict';

  var NEIGHBOR_DELTAS = [
    [+1, -1, 0], [+1, 0, -1], [0, +1, -1],
    [-1, +1, 0], [-1, 0, +1], [0, -1, +1]
  ];

  var cubeCache = [];

  function getCube(x, y, z) {
    cubeCache[x] = cubeCache[x] || [];
    cubeCache[x][y] = cubeCache[x][y] || [];

    if ('undefined' === typeof cubeCache[x][y][z]) {
      cubeCache[x][y][z] = new Cube(x, y, z);
    }

    return cubeCache[x][y][z];
  }

  function Cube(x, y, z) {
    var neighbors;

    function getNeighbors() {
      if (!neighbors) {
        neighbors = NEIGHBOR_DELTAS.map(mapping => getCube(x + mapping[0], y + mapping[1], z + mapping[2]));
      }

      return neighbors;
    }

    // even-q layout
    function getRowColumn() {
      var q = x;
      var r = z + (x + (x&1)) / 2;
      return [r, q];
    }

    function getRing(radius) {
      if (radius <= 0) { return [getCube(x,y,z)]; }

      var currentCubePos = getCube(
        x + (NEIGHBOR_DELTAS[4][0] * radius),
        y + (NEIGHBOR_DELTAS[4][1] * radius),
        z + (NEIGHBOR_DELTAS[4][2] * radius)
      );

      var results = [];
      for (var i = 0; i < 6; i++) {
        for (var j = 0; j < radius; j++) {
          results.push(currentCubePos);
          currentCubePos = currentCubePos.getNeighbors()[i];
        }
      }

      return results;
    }

    function serializeModel() {
      return [x, y, z];
    }

    function toCodeString() {
      return `Cube.getCube(${x}, ${y}, ${z})`;
    }

    return {
      x, y, z,
      getNeighbors,
      getRowColumn,
      getRing,
      serializeModel,
      toCodeString
    };
  }

  function evenQToCube(r, q) {
    var x = q;
    var z = r - (q + (q&1)) / 2;
    var y = -x-z;
    return getCube(x, y, z);
  }

  function deserializeModel([x, y, z]) {
    return getCube(x, y, z);
  }

  function loadFromJSON(data) {
    if (Array.isArray(data)) {
      return deserializeModel(data);
    } else {
      return getCube(data.x, data.y, data.z);
    }
  }

  Cube.evenQToCube = evenQToCube;
  Cube.getCube = getCube;
  Cube.deserializeModel = deserializeModel;
  Cube.loadFromJSON = loadFromJSON;

  return Cube;
})();
