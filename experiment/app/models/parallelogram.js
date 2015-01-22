var DataModel = require('app/util/DataModel');

/**
 * Defines the Guitar data model.
 */
module.exports = (function() {
  'use strict';

  // Describes a single note.
  var ParallelogramNoteModel = DataModel.defineSchema('ParallelogramNoteModel',
    'beat', Number,
    'sound', Number,
    'duration', Number,
    'pid', Number
  );

  // Describes the entire data set of the instrument.
  var ParallelogramInstrumentModel = DataModel.defineSchema('ParallelogramInstrumentModel',
    'recorded', [ParallelogramNoteModel]
  );

  /**
   * Returns the default state is no serialized state is available.
   * @return {Object}
   */
  function getDefault() {
    return {
      'parallelograms': [
        {
          'sound': 'parallelogram_D-sharp-major',
          'color': 0xffffff,
          'hovercolor': 0xF2FBFD
        },
        {
          'sound': 'parallelogram_G-minor',
          'color': 0x4dd0e0,
          'hovercolor': 0x3DCCDE
        },
        {
          'sound': 'parallelogram_G-sharp-major',
          'color': 0xb1eaf2,
          'hovercolor': 0x9FE6EE
        },
        {
          'sound': 'parallelogram_A-sharp-major',
          'color': 0x0097a7,
          'hovercolor': 0x00A9BD
        },
        {
          'sound': 'parallelogram_C-minor',
          'color': 0x006064,
          'hovercolor': 0x007B85
        }
      ],
      'recorded': [
        {
          'beat': 62,
          'sound': 23,
          'duration': 5.1,
          'pid': 0
        },
        {
          'beat': 30,
          'sound': 25,
          'duration': 5.6,
          'pid': 2
        }
      ]
    };
  }

  return {
    ParallelogramNoteModel,
    ParallelogramInstrumentModel,
    getDefault,
    getRootModel: () => ParallelogramInstrumentModel
  };
})();
