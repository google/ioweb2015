module.exports = (function() {
  'use strict';

  /**
   * Get the current scroll of the "window". If we're inside the I/O
   * site, then we need to check a specific container elements.
   */
  return function currentScrollPosition() {
    if (('undefined' !== typeof IOWA) &&
        ('undefined' !== typeof IOWA.Elements) &&
        ('undefined' !== typeof IOWA.Elements.ScrollContainer)) {
      return {
        x: IOWA.Elements.ScrollContainer.scrollLeft,
        y: IOWA.Elements.ScrollContainer.scrollTop
      };
    } else {
      return {
        x: window.scrollX,
        y: window.scrollY
      };
    }
  };
})();
