var events = require('app/util/events');
var Pool = require('app/util/Pool');
var LinkedList = require('app/util/LinkedList');
var { Utils: { ARRAY_TYPE } } = require('p2');
var { EventEmitter } = require('events');

module.exports = (function() {
  'use strict';

  const PLAYBACK_EVENT = 'onPlayback';
  const BEAT_EVENT = 'BEAT';

  /**
   * Listeners to the audio Sequencer and executes callbacks
   * when sounds actually fire (rather than the future scheduling
   * that happens in the audio manager).
   *
   * @constructor
   */
  return function PlaybackBus() {
    // Our event subscriber.
    var eventEmitter = new EventEmitter();

    // Since this will be happening a lot, we use an object pool.
    // This pool if for sound play events.
    var soundDescriptorPool = new Pool(function() {
      return [];
    }, function(v, args) {
      v[0] = args[0];
      v[1] = args[1];
      v[2] = args[2];
      v[3] = args[3];
    });

    // Since this will be happening a lot, we use an object pool.
    // This pool if for beat events.
    var beatDescriptorPool = new Pool(function() {
      return new ARRAY_TYPE(2);
    }, function(v, args) {
      v[0] = args[0];
      v[1] = args[1];
    });

    // We also use Linked Lists to avoid problems when manipulating
    // arrays inside quickly executing loops.
    var scheduledNotes = new LinkedList();
    var scheduledBeats = new LinkedList();

    var currentDelta;

    // Listen to the sequencer's "upcoming beat" event.
    events.addListener('SCHEDULED_BEAT', scheduleRawBeat);

    /**
     * We update our internal information on each
     * requestAnimationFrame loop.
     * @param {number} delta - The time since the last loop.
     */
    function tick(delta) {
      currentDelta = delta;
      scheduledNotes.forEach(eachSoundDescriptor);
      scheduledBeats.forEach(eachBeatDescriptor);
    }

    /**
     * With each sound descriptor, either decrement it's time-until-execution
     * or emit the event of it's playback.
     * @param {array} descriptor - The sound information.
     */
    function eachSoundDescriptor(descriptor) {
      if (currentDelta >= descriptor[0]) {
        scheduledNotes.remove(descriptor);
        eventEmitter.emit(PLAYBACK_EVENT, descriptor[1], descriptor[2], descriptor[3]);
        soundDescriptorPool.free(descriptor);
      } else {
        descriptor[0] -= currentDelta;
      }
    }

    /**
     * With each beat descriptor, either decrement it's time-until-execution
     * or emit the event of it's playback.
     * @param {array} descriptor - The beat information.
     */
    function eachBeatDescriptor(descriptor) {
      if (currentDelta >= descriptor[0]) {
        scheduledBeats.remove(descriptor);
        events.emit(BEAT_EVENT, descriptor[1]);
        beatDescriptorPool.free(descriptor);
      } else {
        descriptor[0] -= currentDelta;
      }
    }

    /**
     * Schedule a new sound to be played in the future.
     * @param {number} time - The time until playback.
     * @param {object} sound - The data representing a sound.
     * @param {number} note - The beat number of the sound playback.
     * @param {number} tags - Bitmask of attached metadata.
     */
    function schedule(time, sound, note, tags) {
      var descriptor = soundDescriptorPool.allocate(time, note, tags, sound);
      scheduledNotes.push(descriptor);
    }

    /**
     * Schedule a new beat to be played in the future.
     * @param {number} note - The beat number.
     * @param {number} time - The time until playback.
     */
    function scheduleRawBeat(note, time) {
      var descriptor = beatDescriptorPool.allocate(time, note);

      scheduledBeats.push(descriptor);
    }

    /**
     * Attach a listener to sound playback.
     * @param {function} cb - The callback.
     */
    function onPlayback(cb) {
      eventEmitter.addListener(PLAYBACK_EVENT, cb);
    }

    return {
      tick: tick,
      schedule: schedule,
      onPlayback: onPlayback
    };
  };
})();
