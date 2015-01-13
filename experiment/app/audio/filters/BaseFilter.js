/**
 * Sets up filter
 * @constructor
 * @param {AudioContext} audioContext - The audio context.
 * @param {string} type - The filter type.
 * @param {number} frequencyValue - The base value of the frequency.
 */
module.exports = function BaseFilter(audioContext, type, frequencyValue) {
  'use strict';

  var filter = audioContext.createBiquadFilter();
  filter.type = type;

  changeFilter(frequencyValue);

  /**
   * Change the audio filter frequency value
   * @param {number} filterVal - The frequency to change to.
   */
  function changeFilter(filterVal) {
    // Clamp the frequency between the minimum value (40 Hz) and half of the
    // sampling rate.
    var minValue = 40;
    var maxValue = audioContext.sampleRate / 2;
    // Logarithm (base 2) to compute how many octaves fall in the range.
    var numberOfOctaves = Math.log(maxValue / minValue) / Math.LN2;
    // Compute a multiplier from 0 to 1 based on an exponential scale.
    var multiplier = Math.pow(2, numberOfOctaves * (filterVal - 1.0));
    // Get back to the frequency value between min and max.
    filter.frequency.value = maxValue * multiplier;
  }

  /**
   * Connect the filter to a Web Audio output node.
   * @param {AudioNode} connectTarget - The target node.
   */
  function connect(connectTarget) {
    filter.connect(connectTarget);
  }

  /**
   * Disconnect the filter from a Web Audio output node.
   */
  function disconnect() {
    filter.disconnect();
  }

  return {
    changeFilter,
    connect,
    disconnect,
    filter
  };
};
