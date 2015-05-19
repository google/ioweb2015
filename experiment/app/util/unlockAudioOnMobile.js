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

// If we're on iOS, wait until an interaction to unlock audio output.
module.exports = function unlockAudioOnMobile(audioContext) {
  'use strict';

  var isLocked = !!(window.navigator.userAgent.match(/Safari/) && window.navigator.userAgent.match(/Mobile/));

  if (isLocked) {
    window.addEventListener('touchstart', unlock, false);
  }

  /**
   * Unlock audio playback on iOS.
   */
  function unlock() {
    if (!isLocked) {
      return;
    }

    // create empty buffer and play it
    var buffer = audioContext.createBuffer(1, 1, 22050);
    var source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);

    // by checking the play state after some time, we know if we're really unlocked
    setTimeout(function() {
      if ((source.playbackState === source.PLAYING_STATE || source.playbackState === source.FINISHED_STATE)) {
        isLocked = false;
        window.removeEventListener('touchstart', unlock);
      }
    }, 0);
  }
};
