var DataModel = require('app/util/DataModel');


/**
 * Defines the Drums data model.
 */
module.exports = (function() {
  'use strict';

  // Describes the location and size of a drum.
  var DrumModel = DataModel.defineSchema('DrumModel',
    'pid', Number,
    'x', Number,
    'y', Number,
    'radius', Number,
    'color', Number,
    'sound', Number
  );

  // Describes the location and size of a dot emitter.
  var EmitterModel = DataModel.defineSchema('DotEmitter',
    'x', Number,
    'y', Number,
    'beatModulo', Number
  );

  // Describes a single note.
  var DrumNoteModel = DataModel.defineSchema('DrumNoteModel',
    'beat', Number,
    'sound', Number,
    'pid', Number
  );

  // Describes the entire data set of the instrument.
  var DrumInstrumentModel = DataModel.defineSchema('DrumInstrumentModel',
    'recorded', [DrumNoteModel],
    'drums', [DrumModel],
    'emitters', [EmitterModel]
  );

  /**
   * Returns the default state is no serialized state is available.
   * @return {Object}
   */
  function getDefault(audioManager) {
    return {
      'drums': [
        {
          'x': -347.5097656250001,
          'y': 62.109375,
          'radius': 70,
          'color': 0xb387ff,
          'hovercolor': 0x976AFF,
          'sound': audioManager.getSound('drumSnare').guid,
          'pid': 0
        },
        {
          'x': -154.1503906250001,
          'y': 223.2421875,
          'radius': 35,
          'color': 0x4527A0,
          'hovercolor': 0x603ACF,
          'sound': audioManager.getSound('drumKick').guid,
          'pid': 1
        },
        {
          'x': 2.6855468749998863,
          'y': -279.4921875,
          'radius': 150,
          'color': 0xede7f6,
          'hovercolor': 0xFFFFFF,
          'sound': audioManager.getSound('drumClap').guid,
          'pid': 2
        },
        {
          'x': -39.208984375000114,
          'y': 9.47265625,
          'radius': 70,
          'color': 0xb387ff,
          'hovercolor': 0x976AFF,
          'sound': audioManager.getSound('drumSnare').guid,
          'pid': 3
        },
        {
          'x': 233.6425781249999,
          'y': 310.25390625,
          'radius': 35,
          'color': 0x4527A0,
          'hovercolor': 0x603ACF,
          'sound': audioManager.getSound('drumKick').guid,
          'pid': 4
        },
        {
          'x': 379.7363281249999,
          'y': 0.87890625,
          'radius': 150,
          'color': 0xede7f6,
          'hovercolor': 0xFFFFFF,
          'sound': audioManager.getSound('drumClap').guid,
          'pid': 5
        }
      ],
      'emitters': [
        {
          'x': -200,
          'y': 700,
          'beatModulo': 2
        },
        {
          'x': 0,
          'y': 700,
          'beatModulo': 4
        },
        {
          'x': 250,
          'y': 700,
          'beatModulo': 8
        }
      ],
      'recorded': [
        {
          'beat': 0,
          'sound': audioManager.getSound('drumClap').guid,
          'pid': 6
        },
        {
          'beat': 3,
          'sound': audioManager.getSound('drumSnare').guid,
          'pid': 4
        },
        {
          'beat': 4,
          'sound': audioManager.getSound('drumKick').guid,
          'pid': 5
        },
        {
          'beat': 7,
          'sound': audioManager.getSound('drumSnare').guid,
          'pid': 4
        },
        {
          'beat': 8,
          'sound': audioManager.getSound('drumClap').guid,
          'pid': 6
        },
        {
          'beat': 11,
          'sound': audioManager.getSound('drumSnare').guid,
          'pid': 4
        },
        {
          'beat': 12,
          'sound': audioManager.getSound('drumKick').guid,
          'pid': 5
        },
        {
          'beat': 15,
          'sound': audioManager.getSound('drumSnare').guid,
          'pid': 4
        },
        {
          'beat': 16,
          'sound': audioManager.getSound('drumClap').guid,
          'pid': 6
        },
        {
          'beat': 19,
          'sound': audioManager.getSound('drumSnare').guid,
          'pid': 4
        },
        {
          'beat': 20,
          'sound': audioManager.getSound('drumKick').guid,
          'pid': 5
        },
        {
          'beat': 23,
          'sound': audioManager.getSound('drumSnare').guid,
          'pid': 4
        },
        {
          'beat': 24,
          'sound': audioManager.getSound('drumClap').guid,
          'pid': 6
        },
        {
          'beat': 27,
          'sound': audioManager.getSound('drumSnare').guid,
          'pid': 4
        },
        {
          'beat': 28,
          'sound': audioManager.getSound('drumKick').guid,
          'pid': 5
        },
        {
          'beat': 31,
          'sound': audioManager.getSound('drumSnare').guid,
          'pid': 4
        },
        {
          'beat': 32,
          'sound': audioManager.getSound('drumClap').guid,
          'pid': 6
        },
        {
          'beat': 35,
          'sound': audioManager.getSound('drumSnare').guid,
          'pid': 4
        },
        {
          'beat': 36,
          'sound': audioManager.getSound('drumKick').guid,
          'pid': 5
        },
        {
          'beat': 39,
          'sound': audioManager.getSound('drumSnare').guid,
          'pid': 4
        },
        {
          'beat': 40,
          'sound': audioManager.getSound('drumClap').guid,
          'pid': 6
        },
        {
          'beat': 43,
          'sound': audioManager.getSound('drumSnare').guid,
          'pid': 4
        },
        {
          'beat': 44,
          'sound': audioManager.getSound('drumKick').guid,
          'pid': 5
        },
        {
          'beat': 47,
          'sound': audioManager.getSound('drumSnare').guid,
          'pid': 4
        },
        {
          'beat': 48,
          'sound': audioManager.getSound('drumClap').guid,
          'pid': 6
        },
        {
          'beat': 51,
          'sound': audioManager.getSound('drumSnare').guid,
          'pid': 4
        },
        {
          'beat': 52,
          'sound': audioManager.getSound('drumKick').guid,
          'pid': 5
        },
        {
          'beat': 55,
          'sound': audioManager.getSound('drumSnare').guid,
          'pid': 4
        },
        {
          'beat': 56,
          'sound': audioManager.getSound('drumClap').guid,
          'pid': 6
        },
        {
          'beat': 59,
          'sound': audioManager.getSound('drumSnare').guid,
          'pid': 4
        },
        {
          'beat': 60,
          'sound': audioManager.getSound('drumKick').guid,
          'pid': 5
        },
        {
          'beat': 63,
          'sound': audioManager.getSound('drumSnare').guid,
          'pid': 4
        }
      ]
    };
  }

  return {
    DrumModel,
    DrumNoteModel,
    DrumInstrumentModel,
    getDefault,
    getRootModel: () => DrumInstrumentModel
  };
})();
