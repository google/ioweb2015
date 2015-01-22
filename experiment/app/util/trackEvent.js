module.exports = (function() {
  'use strict';

  return function trackEvent(name, value) {
    if (('undefined' !== typeof IOWA) &&
        ('undefined' !== typeof IOWA.Analytics) &&
        ('function' === typeof IOWA.Analytics.trackEvent)) {
      IOWA.Analytics.trackEvent('experiment', name, value);
    }
  };
})();
