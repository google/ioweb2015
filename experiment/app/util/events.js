var { EventEmitter } = require('events');

/**
 * Tiny wrapper for a singleton event stream.
 */
module.exports = (function() {
  'use strict';

  var eventEmitter;

  return {
    addListener: function() {
      eventEmitter.addListener.apply(eventEmitter, arguments);
    },
    removeListener: function() {
      eventEmitter.removeListener.apply(eventEmitter, arguments);
    },
    emit: function() {
      eventEmitter.emit.apply(eventEmitter, arguments);
    },
    init: function() {
      eventEmitter = new EventEmitter();
      eventEmitter.setMaxListeners(20);
    }
  };
})();
