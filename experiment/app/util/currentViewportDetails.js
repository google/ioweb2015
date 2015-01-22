module.exports = (function() {
  'use strict';

  /**
   * Get the current scroll of the "window". If we're inside the I/O
   * site, then we need to check a specific container elements.
   */
  return function currentViewportDetails() {
    if (('undefined' !== typeof IOWA) &&
        ('undefined' !== typeof IOWA.Elements) &&
        ('undefined' !== typeof IOWA.Elements.ScrollContainer)) {
      return {
        scrollElement: IOWA.Elements.ScrollContainer,
        x: IOWA.Elements.ScrollContainer.scrollLeft,
        y: IOWA.Elements.ScrollContainer.scrollTop,
        height: IOWA.Elements.ScrollContainer.scrollHeight
      };
    } else {
      return {
        scrollElement: window,
        x: window.scrollX,
        y: window.scrollY,
        height: document.body.getBoundingClientRect().height
      };
    }
  };
})();
