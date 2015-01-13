/**
 * rAF polyfill which doesn't polute the global namespace.
 */
module.exports = (function() {
  'use strict';

  return window.requestAnimationFrame;
})();
