/**
 * Copyright 2014 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

 /**
  * @fileOverview Animations for page transitions.
  */

IOWA.PageAnimation = (function() {

  var CONTENT_SLIDE_DURATION = 400;
  var CONTENT_SLIDE_DELAY = 200;
  var CONTENT_SLIDE_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';
  var CONTENT_SLIDE_LENGTH = '100px';

  var CONTENT_SLIDE_OPTIONS = {
      duration: CONTENT_SLIDE_DURATION,
      easing: CONTENT_SLIDE_EASING,
      fill: 'forwards'
  };

  var CONTENT_SLIDE_DELAY_OPTIONS = {
      duration: CONTENT_SLIDE_DURATION,
      delay: CONTENT_SLIDE_DELAY,
      easing: CONTENT_SLIDE_EASING,
      fill: 'forwards'
  };

  /**
   * Returns an animation to slide and fade out the main content of the page.
   * Used together with slideContentIn for page transitions.
   * @param {Function} callback Callback to be called when animation finishes.
   * @return {Animation} Page animation definition.
   */
  function slideContentOut(callback) {
    var main = document.querySelector('.io-main .slide-up');
    var mainDelayed = document.querySelector('.io-main .slide-up-delay');
    var masthead = IOWA.Elements.Masthead.querySelector('.masthead-meta');
    var start = {
      transform: 'translate(0, 0)',
      opacity: 1
    };
    var end = {
      transform: 'translate(0, ' + CONTENT_SLIDE_LENGTH + ')',
      opacity: 0
    };
    var animation =  new AnimationGroup([
      new Animation(main, [start, end], CONTENT_SLIDE_DELAY_OPTIONS),
      new Animation(mainDelayed, [start, end], CONTENT_SLIDE_OPTIONS),
      new Animation(masthead, [{ opacity: 1 }, { opacity: 0 }],
          CONTENT_SLIDE_OPTIONS)
    ]);
    animation.callback = callback;
    return animation;
  }

  /**
   * Returns an animation to slide up and fade in the main content of the page.
   * Used together with slideContentOut for page transitions.
   * TODO: Should be possible by reversing slideout animation.
   * @param {Function} callback Callback to be called when animation finishes.
   * @return {Animation} Page animation definition.
   */
  function slideContentIn(callback) {
    var main = document.querySelector('.slide-up');
    var mainDelayed = document.querySelector('.slide-up-delay');
    var masthead = IOWA.Elements.Masthead.querySelector('.masthead-meta');
    var start = {
      transform: 'translate(0, ' + CONTENT_SLIDE_LENGTH + ')',
      opacity: 0
    };
    var end = {
      transform: 'translate(0, 0)',
      opacity: 1
    };
    var animationGroup =  new AnimationGroup([
      new Animation(main, [start, end], CONTENT_SLIDE_OPTIONS),
      new Animation(mainDelayed, [start, end], CONTENT_SLIDE_DELAY_OPTIONS),
      new Animation(masthead, [{ opacity: 0 }, { opacity: 1 }],
          CONTENT_SLIDE_OPTIONS)
    ]);
    animationGroup.callback = callback;
    return animationGroup;
  }

  /**
   * Returns an animation to play a color ink ripple.
   * @param {Element} ripple Ripple DOM element.
   * @param {number} x X coordinate of the center of the ripple.
   * @param {number} x Y coordinate of the center of the ripple.
   * @param {boolean} isFadeRipple If true, play a temporary glimpse ripple.
   *     If false, play a regular opaque color ripple.
   * @param {Function} callback Callback to be called when animation finishes.
   * @return {Animation} Ripple animation definition.
   */
  function rippleEffect(ripple, x, y, duration, isFadeRipple, callback) {
    var translate = 'translate3d(' + x + 'px,' + y + 'px, 0)';
    var start = {
      transform: translate + ' scale(0)',
      opacity: isFadeRipple ? 0.5 : 1
    };
    var end = {
      transform: translate + ' scale(1)',
      opacity: isFadeRipple ? 0 : 1
    };
    var animation = new Animation(ripple, [start, end], {
        duration: duration,
        fill: 'forwards'  // Makes ripple keep its state at the end of animation
    });
    animation.callback = callback;
    return animation;
  }

  /**
   * Returns an animation to play a hero card takeover animation. The card
   *     plays a ripple on itself and grows to cover the masthead.
   * @param {Element} card Card DOM element.
   * @param {number} x X coordinate of the center of the ripple.
   * @param {number} x Y coordinate of the center of the ripple.
   * @param {number} duration Duration of the animation.
   * @param {Function} callback Callback to be called when animation finishes.
   * @return {Animation} Ripple animation definition.
   */
  function cardToMasthead(card, x, y, duration, callback) {
    var ripple = card.querySelector('.ripple__content');
    var rippleRect = ripple.getBoundingClientRect();

    var radius = Math.floor(Math.sqrt(rippleRect.width * rippleRect.width +
        rippleRect.height * rippleRect.height));
    ripple.style.width = 2 * radius + 'px';
    ripple.style.height = 2 * radius + 'px';
    ripple.style.left = -radius + 'px';
    ripple.style.top = -radius + 'px';
    ripple.style.zIndex = 1;

    var mastheadRect = IOWA.Elements.Masthead.getBoundingClientRect();
    var scaleX = mastheadRect.width / rippleRect.width;
    var scaleY = mastheadRect.height / rippleRect.height;

    var translate = 'translate3d(' + (-rippleRect.left) + 'px,' +
        (-rippleRect.top)  + 'px, 0)';
    var scale = 'scale(' + scaleX + ', ' + scaleY + ')';
    var start = {
      transform: 'translate3d(0, 0, 0) scale(1)'
    };
    var end = {
      transform: [translate, scale].join(' ')
    };
    card.style.transformOrigin = '0 0';

    var cardTransition = new Animation(card, [start, end], {
        duration: duration,
        fill: 'forwards'
    });

    var animationGroup = new AnimationGroup([
      rippleEffect(ripple, x - rippleRect.left, y - rippleRect.top, duration),
      cardTransition
    ]);

    animationGroup.callback = callback;
    return animationGroup;
  }

  /**
   * Plays an animation, animation group or animation sequence. Calls
   *     a callback when it finishes, if one was assigned.
   * @param {TimedSequence} Animation of AnimationGroup or AnimationSequence.
   */
  function play(animation) {
    var player = document.timeline.play(animation);
    if (animation.callback) {
      player.onfinish = function(e) {
        animation.callback();
      };
    }
  }

  return {
    slideContentOut: slideContentOut,
    slideContentIn: slideContentIn,
    ripple: rippleEffect,
    cardToMasthead: cardToMasthead,
    play: play
  };

})();
