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
  function getDefault() {
    return {
      'recorded': [
        {
          'beat': 1,
          'cube': [-1, 2, -1],
          'sound': 17
        },
        {
          'beat': 16,
          'cube': [3, 0, -3],
          'sound': 19
        },
        {
          'beat': 28,
          'cube': [1, 0, -1],
          'sound': 19
        },
        {
          'beat': 36,
          'cube': [-1, 2, -1],
          'sound': 17
        },
        {
          'beat': 52,
          'cube': [3, 0, -3],
          'sound': 19
        },
        {
          'beat': 63,
          'cube': [0, -1, 1],
          'sound': 18
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
