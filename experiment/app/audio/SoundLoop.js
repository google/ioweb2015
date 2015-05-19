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

module.exports = (function() {
  'use strict';

  // Significantly higher than normal sound GUIDs to avoid collision.
  var nextGUID = 10000;

  /**
   * Models a single SoundLoop.
   * @constructor
   * @param {Object} audioManager - The audio manager.
   * @param {string} name - The name of the sound loop.
   * @param {array} beats - The set of beats.
   */
  return function SoundLoop(audioManager, name, beats) {
    var scheduledNoteNumbers = Object.keys(beats).map(k => parseInt(k, 10));

    /**
     * Play this sound loop.
     * @param {AudioNode} target - Where to play output to.
     * @param {number} time - Offset time to play.
     * @param {number} duration - How long to play.
     * @param {number} bpm - The playback rate.
     * @param {number} note - The current beat.
     * @param {number} tags - Bitmask of metadata.
     */
    function play(target, time, duration, bpm, note, tags) {
      var gainNode = audioManager.audioContext.createGain();

      for (let i = 0; i < scheduledNoteNumbers.length; i++) {
        let beatDetail = beats[scheduledNoteNumbers[i].toString()];
        if (!beatDetail || !beatDetail.length) { continue; }

        for (let j = 0; j < beatDetail.length; j++) {
          let noteDef = beatDetail[j];
          let instrumentName = noteDef.sound;
          let instrument = audioManager.getSound(instrumentName);

          audioManager.willPlayback(
            instrument.play(gainNode, time + (i * bpm)),
            time + (i * bpm),
            { beatNum: note + i },
            tags
          );
        }
      }

      gainNode.connect(target);

      return gainNode;
    }

    return {
      play: play,
      name: name,
      guid: nextGUID++
    };
  };
})();
