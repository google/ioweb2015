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

  var uid = 1;

  /**
   * A track, which contains recorded sounds.
   * @constructor
   * @param {AudioManager} audioManager - The audio manager.
   * @param {object} noteLookup - Beat to sound mapping.
   * @param {Channel} channel - The channel to play on.
   * @param {number} tags - A bitmask of metadata.
   */
  return function Track(audioManager, noteLookup, channel, tags) {
    var id = uid++;
    var target = channel.target;

    /**
     * Called by the sequencer to allow this track to play on each beat.
     * @param {number} note - The current beat.
     * @param {number} time - The time until the beat hits.
     * @param {number} bpm - Current playback rate.
     */
    function playNote(note, time, bpm) {
      var soundsOnNote = noteLookup[note];

      if (soundsOnNote) {
        for (let i = 0; i < soundsOnNote.length; i++) {
          var noteDef = soundsOnNote[i];
          playSound(noteDef.sound, time, noteDef.duration, bpm, note, noteDef);
        }
      }
    }

    /**
     * Play a sound.
     * @param {string|number} soundName - Indentifier for the sound to play.
     * @param {number} time - When to start playing.
     * @param {number} duration - How long to play.
     * @param {number} bpm - The playback rate.
     * @param {number} note - The current beat.
     * @param {object} noteDef - Full information on the current note.
     */
    function playSound(soundName, time, duration, bpm, note, noteDef) {
      var sound = audioManager.getSound(soundName) || audioManager.getSoundLoop(soundName);

      if (!sound) { return; }

      bpm = bpm || audioManager.getSequencer().noteDuration;

      audioManager.willPlayback(
        sound.play(target, time, duration, bpm, note, tags),
        time,
        noteDef,
        tags
      );
    }

    return {
      id,
      playNote,
      playSound
    };
  };
})();
