var DataModel = require('app/util/DataModel');

/**
 * Defines the Arpeggiator data model.
 */
module.exports = (function() {
  'use strict';

  // Describes a single note (in this instrument's case, a looping sequence).
  var ArpeggiatorNoteModel = DataModel.defineSchema('ArpeggiatorNoteModel',
    'beat', Number,
    'quadrant', Number,
    'sound', Number
  );

  // Describes the entire data set of the instrument.
  var ArpeggiatorInstrumentModel = DataModel.defineSchema('ArpeggiatorInstrumentModel',
    'recorded', [ArpeggiatorNoteModel]
  );

  /**
   * Returns the default state is no serialized state is available.
   * @param {AudioManager} audioManager - The central audio manager.
   * @return {ArpeggiatorInstrumentModel}
   */
  function getDefault(audioManager) {
    return {
      'recorded': [
        {
          'beat': 0,
          'quadrant': 0,
          'sound': 10000
        },
        {
          'beat': 6,
          'quadrant': 0,
          'sound': 10000
        },
        {
          'beat': 12,
          'quadrant': 0,
          'sound': 10000
        },
        {
          'beat': 18,
          'quadrant': 2,
          'sound': 10002
        },
        {
          'beat': 24,
          'quadrant': 2,
          'sound': 10002
        },
        {
          'beat': 30,
          'quadrant': 3,
          'sound': 10003
        },
        {
          'beat': 36,
          'quadrant': 3,
          'sound': 10003
        },
        {
          'beat': 42,
          'quadrant': 3,
          'sound': 10003
        },
        {
          'beat': 48,
          'quadrant': 0,
          'sound': 10000
        },
        {
          'beat': 54,
          'quadrant': 0,
          'sound': 10000
        },
        {
          'beat': 60,
          'quadrant': 0,
          'sound': 10000
        },
        {
          'beat': 0,
          'quadrant': 0,
          'sound': 10000
        }
      ]
    };
  }

  return {
    ArpeggiatorNoteModel,
    ArpeggiatorInstrumentModel,
    getDefault,
    getRootModel: () => ArpeggiatorInstrumentModel
  };
})();
