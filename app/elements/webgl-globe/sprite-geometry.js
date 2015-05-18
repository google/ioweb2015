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
 * Generates a vertex array describing an independent quad on the surface of a
 * unit sphere, rotated (and locally oriented) to the `lat` latitude and `lng`
 * longitude specified by each object in the locations array. Each quad is
 * specified with four vertices, so `generateSpriteIndexArray` must be used to
 * generate an index array that can draw triangles from the generated array.
 * @param {!Array<{lat: number, lng: number}} locations
 * @param {number} spriteSize
 * @return {!Float32Array}
 */
IOWA.WebglGlobe.generateSpriteGeometry = (function() {
  'use strict';

  /**
   * Canonical unit-square quad geometry.
   * @const
   * @private {!Array<number>}
   */
  var QUAD_GEOMETRY_ = [
    -1, 1, 0, 1,
    1, 1, 0, 1,
    -1, -1, 0, 1,
    1, -1, 0, 1,
  ];

  /**
   * Increase of sprite size to allow space for anti-aliasing in shader.
   * @const
   * @private {number}
   */
  var SPRITE_SCALE_CORRECTION_ = 1 / 0.75;

  return function generateSpriteGeometry(locations, spriteSize) {
    // 4 verts per sprite, 7 (scalar) attributes per vert, 4 bytes per attribute
    var verts = new ArrayBuffer(locations.length * 4 * 7 * 4);

    // Float32 and int32 views into geometry ArrayBuffer.
    var vertsFloat = new Float32Array(verts);
    var vertsInt = new Int32Array(verts);

    var transform = new IOWA.WebglGlobe.Matrix4x4();
    var geomCursor = 0;

    for (var i = 0; i < locations.length; i++) {
      var loc = locations[i];

      transform.identity()
        .rotateY(loc.lng * Math.PI / 180)
        .rotateX(-loc.lat * Math.PI / 180)
        .translate(0, 0, 1)
        .scaleUniform(spriteSize * SPRITE_SCALE_CORRECTION_);

      for (var j = 0; j < QUAD_GEOMETRY_.length / 4; j++) {
        // Quad, moved to surface of the earth and rotated into place.
        transform.transformOffsetVec4(vertsFloat, geomCursor, QUAD_GEOMETRY_, j * 4);
        geomCursor += 4;

        // Texture coordinates.
        vertsFloat[geomCursor++] = QUAD_GEOMETRY_[j * 4];
        vertsFloat[geomCursor++] = QUAD_GEOMETRY_[j * 4 + 1];

        // Locations index as an int32 to attribute buffer for later lookup.
        // TODO(bckenny): might just raycast this.
        vertsInt[geomCursor++] = i + 1;
      }
    }

    return vertsFloat;
  };
})();

/**
 * Generates an index array describing `spriteCount` number of independent
 * sprite quads.
 * @param {number} spriteCount
 * @return {!Uint16Array}
 */
IOWA.WebglGlobe.generateSpriteIndexArray = function(spriteCount) {
  'use strict';

  var indexArray = new Uint16Array(spriteCount * 6);
  var indexCursor = 0;

  for (var i = 0; i < spriteCount; i++) {
    // |‾/
    // |/
    indexArray[indexCursor++] = i * 4;
    indexArray[indexCursor++] = i * 4 + 2;
    indexArray[indexCursor++] = i * 4 + 1;

    //  /|
    // /_|
    indexArray[indexCursor++] = i * 4 + 1;
    indexArray[indexCursor++] = i * 4 + 2;
    indexArray[indexCursor++] = i * 4 + 3;
  }

  return indexArray;
};
