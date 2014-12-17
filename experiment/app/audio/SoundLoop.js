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

      // Return a single-playback specific method to change volume.
      return {
        setVolume: v => gainNode.gain.value = v
      };
    }

    return {
      play: play,
      name: name,
      guid: nextGUID++
    };
  };
})();
