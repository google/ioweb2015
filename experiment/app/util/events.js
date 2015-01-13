var { EventEmitter } = require('events');


/**
 * Tiny wrapper for a singleton event stream.
 */
var eventEmitter = new EventEmitter();
eventEmitter.setMaxListeners(20);

module.exports = {
  addListener: eventEmitter.addListener.bind(eventEmitter),
  removeListener: eventEmitter.removeListener.bind(eventEmitter),
  emit: eventEmitter.emit.bind(eventEmitter)
};
