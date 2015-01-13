// If we're on iOS, wait until an interaction to unlock audio output.
module.exports = function unlockAudioOnMobile(audioContext) {
  'use strict';

  var isLocked = !!(window.navigator.userAgent.match(/Safari/) && window.navigator.userAgent.match(/Mobile/));

  if (isLocked) {
    window.addEventListener('touchstart', unlock, false);
  }

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
