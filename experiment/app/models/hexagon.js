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

var DataModel = require('app/util/DataModel');
var Cube = require('app/views/hexagon/Cube');

/**
 * Defines the Hexagon data model.
 */
module.exports = (function() {
  'use strict';

  // Describes a single note.
  var HexagonNoteModel = DataModel.defineSchema('HexagonNoteModel',
    'beat', Number,
    'cube', Cube,
    'sound', Number
  );

  // Describes the entire data set of the instrument.
  var HexagonInstrumentModel = DataModel.defineSchema('HexagonInstrumentModel',
    'recorded', [HexagonNoteModel]
  );

  /**
   * Returns the default state is no serialized state is available.
   * @return {Object}
   */
  function getDefault(audioManager) {
    return {
      'recorded': [
        {
          'beat': 1,
          'cube': [-1, 2, -1],
          'sound': audioManager.getSound('hexagon2').guid
        },
        {
          'beat': 16,
          'cube': [3, 0, -3],
          'sound': audioManager.getSound('hexagon4').guid
        },
        {
          'beat': 28,
          'cube': [1, 0, -1],
          'sound': audioManager.getSound('hexagon4').guid
        },
        {
          'beat': 36,
          'cube': [-1, 2, -1],
          'sound': audioManager.getSound('hexagon2').guid
        },
        {
          'beat': 52,
          'cube': [3, 0, -3],
          'sound': audioManager.getSound('hexagon4').guid
        },
        {
          'beat': 63,
          'cube': [0, -1, 1],
          'sound': audioManager.getSound('hexagon3').guid
        }
      ]
    };
  }

  return {
    HexagonNoteModel,
    HexagonInstrumentModel,
    getDefault,
    getRootModel: () => HexagonInstrumentModel
  };
})();
