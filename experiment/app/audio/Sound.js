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

  var soundGUID = 1;

  /**
   * Models a single Sound.
   * @constructor
   * @param {Object} audioManager - The audioManager.
   * @param {number} start - The start of the sound.
   * @param {number} end - The end of the sound.
   * @param {string} name - The sound name.
   */
  return function Sound(audioManager, start, end, name) {
    var guid = soundGUID++;
    var buffer = null;

    var audioContext = audioManager.audioContext;

    var lastPlay = 0;

    /**
     * Set the buffer (decoded MP3 data)
     * @param {AudioBuffer} b - The buffer.
     */
    function setBuffer(b) {
      buffer = b;
    }

    /**
     * Play this sound.
     * @param {AudioNode} target - Where to play output to.
     * @param {number=} optTime - Offset time to play.
     * @param {number=} optDuration - How long to play for.
     */
    function play(target, optTime, optDuration) {
      // If we haven't loaded.
      if (!buffer) { return; }

      var source = audioContext.createBufferSource();
      source.buffer = buffer;

      var gainNode = audioContext.createGain();
      source.connect(gainNode);
      gainNode.connect(target);

      var time = optTime || 0;
      var duration = optDuration || (end - start);

      source.start(time || 0, start, duration);

      lastPlay = audioContext.currentTime;

      // Return a single-playback specific method to change volume.
      return gainNode;
    }

    return {
      guid,
      play,
      name,
      setBuffer
    };
  };
})();
