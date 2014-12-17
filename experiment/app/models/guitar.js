var DataModel = require('app/util/DataModel');


/**
 * Defines the Guitar data model.
 */
module.exports = (function() {
  'use strict';

  // Describes a positioned guitar string.
  var GuitarStringModel = DataModel.defineSchema('GuitarStringModel',
    'pid', Number,
    'pointA', Number,
    'pointB', Number
  );

  // Describes a single note.
  var GuitarNoteModel = DataModel.defineSchema('GuitarNoteModel',
    'beat', Number,
    'sound', Number,
    'pid', Number
  );

  // Describes the entire data set of the instrument.
  var GuitarInstrumentModel = DataModel.defineSchema('GuitarInstrumentModel',
    'recorded', [GuitarNoteModel],
    'strings', [GuitarStringModel],
    'rows', Number,
    'cols', Number
  );

  /**
   * Returns the default state is no serialized state is available.
   * @param {AudioManager} audioManager - The central audio manager.
   * @return {GuitarInstrumentModel}
   */
  function getDefault(audioManager) {
    return {
      'rows': 3,
      'cols': 5,
      'strings': [
        {
          'pid': 0,
          'pointA': 4,
          'pointB': 11
        },
        {
          'pid': 7,
          'pointA': 0,
          'pointB': 10
        },
        {
          'pid': 15,
          'pointA': 1,
          'pointB': 8
        },
        {
          'pid': 20,
          'pointA': 7,
          'pointB': 6
        }
      ],
      'recorded': [
        {
          'beat': 4,
          'sound': 28,
          'pid': 0
        },
        {
          'beat': 5,
          'sound': 27,
          'pid': 20
        },
        {
          'beat': 8,
          'sound': 27,
          'pid': 20
        },
        {
          'beat': 10,
          'sound': 26,
          'pid': 7
        },
        {
          'beat': 13,
          'sound': 29,
          'pid': 15
        },
        {
          'beat': 14,
          'sound': 28,
          'pid': 0
        },
        {
          'beat': 17,
          'sound': 27,
          'pid': 20
        },
        {
          'beat': 19,
          'sound': 26,
          'pid': 7
        },
        {
          'beat': 21,
          'sound': 29,
          'pid': 15
        },
        {
          'beat': 23,
          'sound': 28,
          'pid': 0
        },
        {
          'beat': 25,
          'sound': 29,
          'pid': 15
        },
        {
          'beat': 26,
          'sound': 28,
          'pid': 0
        },
        {
          'beat': 27,
          'sound': 26,
          'pid': 7
        },
        {
          'beat': 29,
          'sound': 27,
          'pid': 20
        },
        {
          'beat': 31,
          'sound': 29,
          'pid': 15
        },
        {
          'beat': 33,
          'sound': 28,
          'pid': 0
        },
        {
          'beat': 36,
          'sound': 28,
          'pid': 0
        },
        {
          'beat': 37,
          'sound': 26,
          'pid': 7
        },
        {
          'beat': 41,
          'sound': 27,
          'pid': 20
        },
        {
          'beat': 42,
          'sound': 28,
          'pid': 0
        },
        {
          'beat': 43,
          'sound': 29,
          'pid': 15
        },
        {
          'beat': 45,
          'sound': 28,
          'pid': 0
        },
        {
          'beat': 48,
          'sound': 28,
          'pid': 0
        },
        {
          'beat': 49,
          'sound': 26,
          'pid': 7
        },
        {
          'beat': 53,
          'sound': 27,
          'pid': 20
        },
        {
          'beat': 53,
          'sound': 28,
          'pid': 0
        },
        {
          'beat': 55,
          'sound': 29,
          'pid': 15
        },
        {
          'beat': 58,
          'sound': 28,
          'pid': 0
        },
        {
          'beat': 58,
          'sound': 29,
          'pid': 15
        },
        {
          'beat': 60,
          'sound': 28,
          'pid': 0
        },
        {
          'beat': 62,
          'sound': 26,
          'pid': 7
        }
      ]
    };
  }

  return {
    GuitarStringModel,
    GuitarNoteModel,
    GuitarInstrumentModel,
    getDefault,
    getRootModel: () => GuitarInstrumentModel
  };
})();
