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

  var canRunSimultanousAnimations = (/Safari/gi).test(navigator.userAgent ||
      (/Chrome/gi).test(navigator.userAgent));
  var pageState = null;

  /**
   * Returns an animation to play a hero card takeover animation. The card
   *     plays a ripple on itself and grows to cover the masthead.
   * @param {Element} card Card DOM element.
   * @param {number} x X coordinate of the center of the ripple.
   * @param {number} x Y coordinate of the center of the ripple.
   * @param {number} duration Duration of the animation.
   * @return {Animation} Ripple animation definition.
   */
  function pageFirstRender(el, options) {
    return new AnimationGroup([
      slideContentIn(),
      elementFadeIn(IOWA.Elements.MastheadMeta, CONTENT_SLIDE_OPTIONS)
    ], CONTENT_SLIDE_OPTIONS);
  }

/**
   * Returns an animation to play a hero card takeover animation. The card
   *     plays a ripple on itself and grows to cover the masthead.
   * @param {Element} card Card DOM element.
   * @param {number} x X coordinate of the center of the ripple.
   * @param {number} x Y coordinate of the center of the ripple.
   * @param {number} duration Duration of the animation.
   * @return {Animation} Ripple animation definition.
   */
  function fadeOutElement(el, options) {
    options.fill = 'forwards'; // Always keep the state at the end of animation.
    return new Animation(el, [{ opacity: 1 }, { opacity: 0 }], options);
  }

  /**
   * Returns an animation to play a hero card takeover animation. The card
   *     plays a ripple on itself and grows to cover the masthead.
   * @param {Element} card Card DOM element.
   * @param {number} x X coordinate of the center of the ripple.
   * @param {number} x Y coordinate of the center of the ripple.
   * @param {number} duration Duration of the animation.
   * @return {Animation} Ripple animation definition.
   */
  function elementFadeIn(el, options) {
    options.fill = 'forwards'; // Always keep the state at the end of animation.
    return new Animation(el, [{ opacity: 0 }, { opacity: 1 }], options);
  }

  /**
   * Returns an animation to slide and fade out the main content of the page.
   * Used together with slideContentIn for page transitions.
   * @return {Animation} Page animation definition.
   */
  function fadeContentOut() {
    var main = document.querySelector('.slide-up');
    var mainDelayed = document.querySelector('.slide-up-delay');
    var masthead = IOWA.Elements.Masthead.querySelector('.masthead-meta');
    var start = {
      opacity: 1
    };
    var end = {
      opacity: 0
    };
    var animation =  new AnimationGroup([
      new Animation(main, [start, end], CONTENT_SLIDE_DELAY_OPTIONS),
      new Animation(mainDelayed, [start, end], CONTENT_SLIDE_DELAY_OPTIONS),
      fadeOutElement(masthead, CONTENT_SLIDE_OPTIONS),
      fadeOutElement(IOWA.Elements.IOLogoLarge, {'duration': 0}),
      new Animation(IOWA.Elements.Footer, [{ opacity: 1 }, { opacity: 0 }],
          CONTENT_SLIDE_OPTIONS)
    ]);
    animation.pageState = 'slideContentOut';
    return animation;
  }

  /**
   * Returns an animation to slide and fade out the main content of the page.
   * Used together with slideContentIn for page transitions.
   * @return {Animation} Page animation definition.
   */
  function slideContentOut() {
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
          CONTENT_SLIDE_OPTIONS),
      fadeOutElement(IOWA.Elements.IOLogoLarge, {'duration': 0}),
      new Animation(IOWA.Elements.Footer, [{ opacity: 1 }, { opacity: 0 }],
          CONTENT_SLIDE_OPTIONS)
    ]);
    animation.pageState = 'slideContentOut';
    return animation;
  }

  /**
   * Returns an animation to slide up and fade in the main content of the page.
   * Used together with slideContentOut for page transitions.
   * TODO: Should be possible by reversing slideout animation.
   * @return {Animation} Page animation definition.
   */
  function slideContentIn() {
    var main = document.querySelector('.slide-up');
    var mainDelayed = document.querySelector('.slide-up-delay');
    //var masthead = IOWA.Elements.Masthead.querySelector('.masthead-meta');
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
      //new Animation(masthead, [{ opacity: 0 }, { opacity: 1 }],
      //    CONTENT_SLIDE_OPTIONS),
      //new Animation(IOWA.Elements.IOLogoLarge, [{ opacity: 0 }, { opacity: 1 }],
      //    CONTENT_SLIDE_OPTIONS),
      new Animation(IOWA.Elements.Footer, [{ opacity: 0 }, { opacity: 1 }],
          CONTENT_SLIDE_OPTIONS)
    ]);
    animationGroup.pageState = 'slideContentIn';
    return animationGroup;
  }

  /**
   * Returns an animation to slide up and fade in the main content of the page.
   * Used together with slideContentOut for page transitions.
   * TODO: Should be possible by reversing slideout animation.
   * @return {Animation} Page animation definition.
   */
  function pageSlideIn() {
    var animationGroup =  new AnimationGroup([
      slideContentIn(),
      fadeMastheadIn()
    ], CONTENT_SLIDE_OPTIONS);
    return animationGroup;
  }

  /**
   * Returns an animation to slide up and fade in the main content of the page.
   * Used together with slideContentOut for page transitions.
   * TODO: Should be possible by reversing slideout animation.
   * @return {Animation} Page animation definition.
   */
  function navSlideOut() {
    console.log('navSlideOut')
    var animation =  new Animation(IOWA.Elements.Nav, [
       {transform: 'translateY(0)'},
       {transform: 'translateY(-100px)'}
    ], CONTENT_SLIDE_OPTIONS);
    return animation;
  }

  /**
   * Returns an animation to slide up and fade in the main content of the page.
   * Used together with slideContentOut for page transitions.
   * TODO: Should be possible by reversing slideout animation.
   * @return {Animation} Page animation definition.
   */
  function navSlideIn() {
    console.log('navSlidein')
    var animation =  new Animation(IOWA.Elements.Nav, [
       {transform: 'translateY(-100px)'},
       {transform: 'translateY(0)'}
    ], CONTENT_SLIDE_OPTIONS);
    return animation;
  }

  /**
   * Returns an animation to slide up and fade in the main content of the page.
   * Used together with slideContentOut for page transitions.
   * TODO: Should be possible by reversing slideout animation.
   * @return {Animation} Page animation definition.
   */
  function slideNavIn() {
    var animation =  new Animation(IOWA.Elements.Nav, [
       {transform: 'translateY(-100px)'},
       {transform: 'translateY(0)'}
    ], CONTENT_SLIDE_OPTIONS);
    //animation.pageState = 'pageSlideIn';
    return animation;
  }

  /**
   * Returns an animation to slide up and fade in the main content of the page.
   * Used together with slideContentOut for page transitions.
   * TODO: Should be possible by reversing slideout animation.
   * @return {Animation} Page animation definition.
   */
  function fadeMastheadIn() {
    var masthead = IOWA.Elements.Masthead.querySelector('.masthead-meta');
    var animationGroup =  new AnimationGroup([
      new Animation(masthead, [{ opacity: 0 }, { opacity: 1 }],
          CONTENT_SLIDE_OPTIONS),
      new Animation(IOWA.Elements.IOLogoLarge, [{ opacity: 0 }, { opacity: 1 }],
          CONTENT_SLIDE_OPTIONS)
    ]);
    animationGroup.pageState = 'slideContentIn';
    return animationGroup;
  }

  /**
   * Returns an animation to play a color ink ripple.
   * @param {Element} ripple Ripple DOM element.
   * @param {number} x X coordinate of the center of the ripple.
   * @param {number} y Y coordinate of the center of the ripple.
   * @param {number} duration How long is the animation.
   * @param {string} duration color Ripple color.
   * @param {boolean} isFadeRipple If true, play a temporary glimpse ripple.
   *     If false, play a regular opaque color ripple.
   * @return {Animation} Ripple animation definition.
   */
  function rippleEffect(ripple, x, y, duration, color, isFadeRipple) {
    var translate = 'translate3d(' + x + 'px,' + y + 'px, 0)';
    var start = {
      transform: translate + ' scale(0)',
      opacity: isFadeRipple ? 0.5 : 1,
      backgroundColor: color
    };
    var end = {
      transform: translate + ' scale(1)',
      opacity: isFadeRipple ? 0 : 1,
      backgroundColor: color
    };
    var animation = new Animation(ripple, [start, end], {
        duration: duration,
        fill: 'forwards'  // Makes ripple keep its state at the end of animation
    });
    return animation;
  }

  /**
   * Returns an animation to play a hero card takeover animation. The card
   *     plays a ripple on itself and grows to cover the masthead.
   * @param {Element} card Card DOM element.
   * @param {number} x X coordinate of the center of the ripple.
   * @param {number} x Y coordinate of the center of the ripple.
   * @param {number} duration Duration of the animation.
   * @return {Animation} Ripple animation definition.
   */
  function pageCardTakeoverOut(card, x, y, duration, color) {
    var ripple = card.querySelector('.ripple__content');
    var rippleRect = ripple.getBoundingClientRect();

    var radius = Math.floor(Math.sqrt(rippleRect.width * rippleRect.width +
        rippleRect.height * rippleRect.height));
    ripple.style.width = 2 * radius + 'px';
    ripple.style.height = 2 * radius + 'px';
    ripple.style.left = -radius + 'px';
    ripple.style.top = -radius + 'px';


    ripple.parentNode.style.zIndex = 2;
    ripple.style.backgroundColor = color;
    ripple.style.zIndex = 2;

    //debugger;

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
    console.log(translate, scale)
    card.style.transformOrigin = '0 0';

    var cardTransition = new Animation(card, [start, end], {
        duration: duration,
        fill: 'forwards'
    });

    var mainDelayed = document.querySelector('.slide-up-delay');
    var masthead = IOWA.Elements.Masthead.querySelector('.masthead-meta');



    var animationGroup = new AnimationGroup([
      rippleEffect(ripple, x - rippleRect.left, y - rippleRect.top, duration),
      cardTransition,
      navSlideOut(),
      fadeOutElement(mainDelayed, CONTENT_SLIDE_OPTIONS)
    ]);

    var seq = new AnimationSequence([
      animationGroup,
      fadeOutElement(IOWA.Elements.Ripple, {'duration': 0}),
      fadeOutElement(IOWA.Elements.IOLogoLarge, {'duration': 0}),
      fadeOutElement(IOWA.Elements.Footer, {'duration': 0}),
      fadeOutElement(masthead, {'duration': 0}),
    ])
    seq.pageState = 'pageCardTakeoverOut';
    return seq;
  }

  /**
   * Returns an animation to play a hero card takeover animation. The card
   *     plays a ripple on itself and grows to cover the masthead.
   * @param {Element} card Card DOM element.
   * @param {number} x X coordinate of the center of the ripple.
   * @param {number} x Y coordinate of the center of the ripple.
   * @param {number} duration Duration of the animation.
   * @return {Animation} Ripple animation definition.
   */
  function pageCardTakeoverIn() {

    console.log('pageCardTakeoverIn')
    var seq = new AnimationGroup([
      pageSlideIn(),
      navSlideIn()


    ], CONTENT_SLIDE_OPTIONS)
    seq.pageState = 'pageCardTakeoverOut';
    return seq;
  }



  /**
   * Plays an animation, animation group or animation sequence. Calls
   *     a callback when it finishes, if one was assigned.
   * @param {TimedSequence} Animation of AnimationGroup or AnimationSequence.
   */
  function play(animation, callback) {
    var player = document.timeline.play(animation);
    if (animation.pageState) {
      IOWA.PageAnimation.pageState = animation.pageState;
    }
    if (callback) {
      player.onfinish = function(e) {
        callback();
      };
    }
  }

  return {
    canRunSimultanousAnimations: canRunSimultanousAnimations,
    pageState: pageState,
    fadeContentOut: fadeContentOut,
    slideContentOut: slideContentOut,
    slideContentIn: slideContentIn,
    //slidePageOut: slidePageOut,
    pageSlideIn: pageSlideIn,
    ripple: rippleEffect,
    pageCardTakeoverOut: pageCardTakeoverOut,
    pageCardTakeoverIn: pageCardTakeoverIn,
    pageFirstRender: pageFirstRender,
    play: play
  };

})();
