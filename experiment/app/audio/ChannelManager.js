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

var animate = require('app/util/animate');

module.exports = (function() {
  'use strict';

  const FADE_OUT_DURATION = 0.5;
  const FADE_IN_DURATION = 1.0;
  const MUTE_LEVEL = 0.2;

  /**
   * A single channel.
   * @constructor
   * @param {Object} audioContext - The Web Audio context.
   * @param {GainNode} gainNode - The final output of all channels.
   */
  function Channel(audioContext, gainNode, baseVolume) {
    var output = audioContext.createGain();
    output.connect(gainNode);

    var analyser = audioContext.createAnalyser();
    analyser.connect(output);

    this.output = output;
    this.analyser = analyser;
    this.target = analyser;
    this.muted = true;

    this.baseVolume = baseVolume;

    this.setVolume = function(v) {
      output.gain.value = v;
    };
  }

  /**
   * The channel manager keeps track of different named channels
   * which an instrument can connect to. This allows per-instrument
   * volume tweening and audio analysis.
   *
   * @constructor
   * @param {AudioContext} audioContext - The main audio context.
   * @param {GainNode} gainNode - The final output of all channels.
   */
  return function ChannelManager(audioContext, gainNode) {
    var channels = [];

    /**
     * Create and register a new channel.
     * @return {Channel}
     */
    function create(baseVolume=0.5) {
      var chan = new Channel(audioContext, gainNode, baseVolume);
      channels.push(chan);

      unmute(chan);

      return chan;
    }

    /**
     * Mute a channel. Optionally fade the volume down.
     * @param {Channel} chan - The channel.
     * @param {number} duration - The fade duration.
     */
    function mute(chan, duration) {
      if (chan.muted) { return; }

      duration = duration || FADE_OUT_DURATION;
      chan.muted = true;

      var muteLevel = MUTE_LEVEL * chan.baseVolume;

      animate({ volume: chan.baseVolume }, duration, {
        volume: muteLevel,
        ease: Linear.easeNone,
        onUpdate: function() {
          chan.setVolume(this.target.volume);
        }
      });
    }

    /**
     * Unmute a channel. Optionally fade the volume up.
     * @param {Channel} chan - The channel.
     * @param {number} duration - The fade duration.
     */
    function unmute(chan, duration) {
      if (!chan.muted) { return; }

      duration = duration || FADE_IN_DURATION;

      var muteLevel = MUTE_LEVEL * chan.baseVolume;

      chan.setVolume(muteLevel);
      chan.muted = false;

      animate({ volume: muteLevel }, duration, {
        volume: chan.baseVolume,
        ease: Linear.easeNone,
        onUpdate: function() {
          chan.setVolume(this.target.volume);
        }
      });
    }

    /**
     * Mute all channels, except one. Useful for "solo mode".
     * @param {Channel} exceptChan - The channel to allow through.
     * @param {number} duration - The fade duration.
     */
    function muteAllExcept(exceptChan, duration) {
      for (let i = 0; i < channels.length; i++) {
        let chan = channels[i];
        if (chan !== exceptChan) {
          mute(chan, duration);
        }
      }
    }

    /**
     * Unmute all channels, except one. Useful for "solo mode".
     * @param {Channel} exceptChan - The channel to allow through.
     * @param {number} duration - The fade duration.
     */
    function unmuteAllExcept(exceptChan, duration) {
      for (let i = 0; i < channels.length; i++) {
        let chan = channels[i];
        if (chan !== exceptChan) {
          unmute(chan, duration);
        }
      }
    }

    return {
      create,
      muteAllExcept,
      unmuteAllExcept
    };
  };
})();
