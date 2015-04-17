/**
 * @group Polymer Mixins
 *
 * `Polymer.IOFocusable` is a mixin for elements that the user can interact with.
 * Elements using this mixin will receive attributes reflecting the focus, pressed
 * and disabled states. It's a stripped down version of CoreFocusable used to work around
 * conflicts with CoreFocusable and paper-radio-button. Specifically CoreFocusable overrides
 * the `toggle` method of `paper-radio-button` with a `toggle` boolean. This breaks the
 * element when clicked on.
 *
 * @element Polymer.IOFocusable
 */

Polymer.IOFocusable = {

  mixinDelegates: {
    down: '_downAction',
    up: '_upAction',
    focus: '_focusAction',
    blur: '_blurAction'
  },

  _downAction: function() {
    this.classList.add('pressed');
    // this hackery is required for paper-slider which prevents
    // default on mousedown so dragging doesn't select text on screen
    // without a proper mousedown, focus does not move off of the slider
    // if you click on another slider
    this.focus();
  },

  _upAction: function() {
    this.classList.remove('pressed');
  },

  _focusAction: function() {
    // Only render the "focused" state if the element gains focus due to
    // keyboard navigation.
    if (!this.classList.contains('pressed')) {
      this.classList.add('focused');
    }
  },

  _blurAction: function() {
    this.classList.remove('focused');
  }

};
