/**
 * Track page & tab visibility to mute sounds when we're not focused.
 * @param {function} start - Function to call on start.
 * @param {function} stop - Function to call on stop.
 */
module.exports = function addVisibilityChangeListener(start, stop) {
  'use strict';

  var hiddenProp = (function getHiddenProp() {
    return 'hidden';
  })();

  if (hiddenProp) {
    var eventName = hiddenProp.replace(/hidden/, '') + 'visibilitychange';

    // Pause on tab change
    document.addEventListener(eventName, function() {
      if (document[hiddenProp]) {
        stop();
      } else {
        start();
      }
    }, false);
  }
};
