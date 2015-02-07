var { vec2 } = require('p2');
var { Promise } = require('es6-promise');
var animate = require('app/util/animate');
var currentViewportDetails = require('app/util/currentViewportDetails');

module.exports = (function() {
  'use strict';

  /**
   * Manages the mask effect when initializing or closing.
   * @param {string} maskClass - Class to use on DOM element when masking.
   */
  return function MaskManager(maskClass) {
    var useHiddenWebkitMask = !!document.getCSSCanvasContext;

    var ctx;
    var viewportElement;

    /**
     * Animate the experiment in.
     * @param {number} x - The initial x position.
     * @param {number} y - The initial y position.
     * @return {Promise}
     */
    function animateIn(x, y) {
      if (useHiddenWebkitMask) {
        return animateInWebkitMask(x, y);
      } else {
        return fadeIn();
      }
    }

    /**
     * Animate the experiment out.
     * @param {number} x - The initial x position.
     * @param {number} y - The initial y position.
     * @return {Promise}
     */
    function animateOut(x, y) {
      if (useHiddenWebkitMask) {
        return animateOutWebkitMask(x, y);
      } else {
        return fadeOut();
      }
    }

    /**
     * Get the minimum radius to cover the page given a starting point.
     * @param {number} x - The initial x position.
     * @param {number} y - The initial y position.
     * @return {number}
     */
    function getRadius(x, y) {
      var center = vec2.fromValues(x, y);
      var corner1 = vec2.fromValues(0, 0);
      var corner2 = vec2.fromValues(0, window.innerHeight);
      var corner3 = vec2.fromValues(window.innerWidth, 0);
      var corner4 = vec2.fromValues(window.innerWidth, window.innerHeight);

      return Math.max(
        vec2.distance(center, corner1),
        vec2.distance(center, corner2),
        vec2.distance(center, corner3),
        vec2.distance(center, corner4)
      ) + 5;
    }

    /**
     * Animate the mask in.
     * @param {number} x - The initial x position.
     * @param {number} y - The initial y position.
     * @return {Promise}
     */
    function animateInWebkitMask(x, y) {
      var radius = getRadius(x, y);

      var data = {
        r1: 0,
        r2: 0,
        r3: 0,
        r4: 0,
        r5: 0
      };

      function draw() {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        ctx.save();
        ctx.translate(x, y);

        ctx.globalCompositeOperation = 'source-over';

        ctx.beginPath();
        ctx.arc(0, 0, data.r1, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalCompositeOperation = 'destination-out';

        ctx.beginPath();
        ctx.arc(0, 0, data.r2, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalCompositeOperation = 'source-over';

        ctx.beginPath();
        ctx.arc(0, 0, data.r3, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalCompositeOperation = 'destination-out';

        ctx.beginPath();
        ctx.arc(0, 0, data.r4, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalCompositeOperation = 'source-over';

        ctx.beginPath();
        ctx.arc(0, 0, data.r5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      var total = 46 / 30;
      var smallGap = 8 / 30;
      var largeGap = 12 / 30;

      var lastDuration = 53 / 30;
      var lastStart = 27 / 30;

      draw();
      addMask();

      return Promise.all([
        animate.to(data, total, { r1: radius, delay: 0, onUpdate: draw, ease: Circ.easeInOut }),
        animate.to(data, total, { r2: radius, delay: smallGap, onUpdate: draw, ease: Circ.easeInOut }),
        animate.to(data, total, { r3: radius, delay: largeGap, onUpdate: draw, ease: Circ.easeInOut }),
        animate.to(data, total, { r4: radius, delay: largeGap + smallGap, onUpdate: draw, ease: Circ.easeInOut }),
        animate.to(data, lastDuration, { r5: radius, delay: lastStart, onUpdate: draw, ease: Circ.easeInOut })
      ]).then(animateComplete);
    }

    /**
     * Animate the mask out.
     * @param {number} x - The initial x position.
     * @param {number} y - The initial y position.
     * @return {Promise}
     */
    function animateOutWebkitMask(x, y) {
      var data = {
        radius: getRadius(x, y)
      };

      function draw() {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        ctx.save();
        ctx.translate(x, y);

        ctx.beginPath();
        ctx.arc(0, 0, data.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      draw();
      addMask();

      return animate
        .to(data, 2, { radius: 0, delay: 0, onUpdate: draw, ease: Expo.easeInOut })
        .then(animateComplete);
    }

    /**
     * Fade the experiment in.
     * @return {Promise}
     */
    function fadeIn() {
      return animate.to(viewportElement, 0.8, {
        opacity: 1,
        ease: Circ.easeOut
      }).then(animateComplete);
    }

    /**
     * When a transition is complete.
     */
    function animateComplete() {
      if (useHiddenWebkitMask) {
        removeMask();
      }
    }

    /**
     * Fade the experiment out.
     * @return {Promise}
     */
    function fadeOut() {
      return animate.to(viewportElement, 0.8, {
        opacity: 0,
        ease: Circ.easeOut
      }).then(animateComplete);
    }

    /**
     * Initialize the mask manager.
     * @param {Element} viewportElement_ - The containing viewport.
     */
    function init(viewportElement_) {
      viewportElement = viewportElement_;
      if (useHiddenWebkitMask) {
        ctx = document.getCSSCanvasContext('2d', 'wipe', window.innerWidth, window.innerHeight);
        ctx.fillStyle = 'black';
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        addMask();
      } else {
        viewportElement.style.opacity = 0;
      }
    }

    /**
     * Add the mask.
     */
    function addMask() {
      viewportElement.classList.add(maskClass);
      viewportElement.style.webkitMaskPosition = `0 ${currentViewportDetails().y}px`;
    }

    /**
     * Remove the mask when done.
     */
    function removeMask() {
      viewportElement.classList.remove(maskClass);
    }

    return {
      init,
      animateIn,
      animateOut
    };
  };
})();
