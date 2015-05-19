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
   * @return {Object}
   */
  function getDefault(audioManager) {
    return {
      'recorded': [
        {
          'beat': 0,
          'quadrant': 0,
          'sound': audioManager.getSoundLoop('arp1').guid
        },
        {
          'beat': 6,
          'quadrant': 0,
          'sound': audioManager.getSoundLoop('arp1').guid
        },
        {
          'beat': 12,
          'quadrant': 0,
          'sound': audioManager.getSoundLoop('arp1').guid
        },
        {
          'beat': 18,
          'quadrant': 2,
          'sound': audioManager.getSoundLoop('arp3').guid
        },
        {
          'beat': 24,
          'quadrant': 2,
          'sound': audioManager.getSoundLoop('arp3').guid
        },
        {
          'beat': 30,
          'quadrant': 3,
          'sound': audioManager.getSoundLoop('arp4').guid
        },
        {
          'beat': 36,
          'quadrant': 3,
          'sound': audioManager.getSoundLoop('arp4').guid
        },
        {
          'beat': 42,
          'quadrant': 3,
          'sound': audioManager.getSoundLoop('arp4').guid
        },
        {
          'beat': 48,
          'quadrant': 0,
          'sound': audioManager.getSoundLoop('arp1').guid
        },
        {
          'beat': 54,
          'quadrant': 0,
          'sound': audioManager.getSoundLoop('arp1').guid
        },
        {
          'beat': 60,
          'quadrant': 0,
          'sound': audioManager.getSoundLoop('arp1').guid
        },
        {
          'beat': 0,
          'quadrant': 0,
          'sound': audioManager.getSoundLoop('arp1').guid
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
