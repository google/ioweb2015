var rAF = require('app/util/raf');

module.exports = (function() {
  'use strict';

  var currentTime = ('function' === typeof window.performance.webkitNow) ? window.performance.webkitNow.bind(window.performance) : window.performance.now.bind(window.performance);

  return function rAFTimeout(fn, timeout) {
    timeout = timeout || 0;

    var previousTime = currentTime();

    function onFrame() {
      var time = currentTime();
      var delta = time - previousTime;

      timeout -= delta;

      var isDone = timeout <= 0;

      if (isDone) {
        return fn();
      }

      previousTime = time;
      rAF(onFrame);
    }

    rAF(onFrame);
  };
})();
