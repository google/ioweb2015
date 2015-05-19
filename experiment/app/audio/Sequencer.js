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

var Metronome = require('app/audio/Metronome');
var Track = require('app/audio/Track');
var events = require('app/util/events');

const TOTAL_BEATS = 64;
const LOOK_AHEAD_MS = 100.0;
const TEMPO_BPM = 100.0;
const SECONDS_PER_BEAT = 60.0 / TEMPO_BPM;
const A_16TH_NOTE_DURATION = 0.25 * SECONDS_PER_BEAT;
const SCHEDULE_AHEAD_SECONDS = 0.1;

/**
 * Central controller for the Audio sequencer.
 * @param {AudioManager} audioManager - The main audio manager.
 * @constructor
 */
module.exports = function Sequencer(audioManager) {
  'use strict';

  var audioContext = audioManager.audioContext;

  var tracks = {};

  var current16thNote = 0;
  var nextNoteTime = 0.0;

  var metronome = new Metronome();
  metronome.setInterval(LOOK_AHEAD_MS);
  metronome.onTick(onTick);

  /**
   * Start the sequencer.
   */
  function start() {
    nextNoteTime = audioContext.currentTime;
    metronome.start();
  }

  /**
   * Stop the sequencer.
   */
  function stop() {
    metronome.stop();
  }

  /**
   * On each metronome tick. Schedule upcoming notes.
   */
  function onTick() {
    // while there are notes that will need to play before the next interval,
    // schedule them and advance the pointer.
    while (nextNoteTime < audioContext.currentTime + SCHEDULE_AHEAD_SECONDS) {
      scheduleNote(current16thNote, nextNoteTime);
      nextNote();
    }
  }

  /**
   * Length of loop in seconds.
   * @return {number}
   */
  function loopLengthSecs() {
    return TOTAL_BEATS * A_16TH_NOTE_DURATION;
  }

  /**
   * Length of loop in beats.
   * @return {number}
   */
  function loopLength() {
    return TOTAL_BEATS;
  }

  /**
   * Beat length.
   * @return {number}
   */
  function beatLength() {
    return A_16TH_NOTE_DURATION;
  }

  /**
   * Move to the next note.
   */
  function nextNote() {
    nextNoteTime += A_16TH_NOTE_DURATION;
    current16thNote++;
    if (current16thNote === TOTAL_BEATS) {
      current16thNote = 0;
    }
  }

  /**
   * Play a sound on the next beat.
   * @param {object} sound - The sound definition.
   * @param {AudioNode} target - The output destination.
   */
  function playNext(sound, target) {
    sound.play(target, nextNoteTime + A_16TH_NOTE_DURATION);
  }

  /**
   * Schedule a note.
   * @param {number} beatNumber - The beat number.
   * @param {number} time - When the play the note.
   */
  function scheduleNote(beatNumber, time) {
    events.emit('SCHEDULED_BEAT', beatNumber, time - audioContext.currentTime);

    for (var key in tracks) {
      if (tracks.hasOwnProperty(key)) {
        tracks[key].playNote(beatNumber, time, A_16TH_NOTE_DURATION);
      }
    }
  }

  /**
   * Add a track to the sequence.
   * @param {Track} track - The track.
   */
  function addTrack(track) {
    tracks[track.id] = track;
  }

  /**
   * Remove a track from the sequence.
   * @param {Track} track - The track.
   */
  function removeTrack(track) {
    delete tracks[track.id];
  }

  /**
   * Create a new track.
   * @param {object} notes - What to play on which beats.
   * @param {Channel} channel - Which channel to play on.
   * @param {number} tags - Bitmask of metadata.
   * @return {Track}
   */
  function createTrack(notes, channel, tags) {
    return new Track(audioManager, notes, channel, tags);
  }

  /**
   * Create a Track by looping a single sound every so often.
   * @param {object} sound - The sound information.
   * @param {number} frequency - How often to loop.
   * @param {Channel} channel - The channel to play on.
   * @param {number} tags - Bitmask of metadata.
   * @return {Track}
   */
  function createLoopingTrack(sound, frequency, channel, tags) {
    var notes = {};

    for (let i = 0; i < TOTAL_BEATS; i += frequency) {
      notes[i.toString()] = [{ 'sound': sound }];
    }

    return createTrack(notes, channel, tags);
  }

  return {
    addTrack,
    loopLength,
    loopLengthSecs,
    beatLength,
    removeTrack,
    createTrack,
    createLoopingTrack,
    start,
    stop,
    playNext,
    noteDuration: A_16TH_NOTE_DURATION
  };
};
