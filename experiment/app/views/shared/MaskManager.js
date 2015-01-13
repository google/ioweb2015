var { vec2 } = require('p2');
var { Promise } = require('es6-promise');
var animate = require('app/util/animate');

module.exports = function MaskManager(maskClass) {
  'use strict';

  var useHiddenWebkitMask = !!document.getCSSCanvasContext;

  var ctx;
  var viewportElement;

  function animateIn(x, y) {
    if (useHiddenWebkitMask) {
      return animateInWebkitMask(x, y);
    } else {
      return fadeIn();
    }
  }

  function animateOut(x, y) {
    // if (useHiddenWebkitMask) {
    //   return animateOutWebkitMask(x, y);
    // } else {
      return fadeOut();
    // }
  }

  function animateInWebkitMask(x, y) {
    var center = vec2.fromValues(x, y);
    var corner1 = vec2.fromValues(0, 0);
    var corner2 = vec2.fromValues(0, window.innerHeight);
    var corner3 = vec2.fromValues(window.innerWidth, 0);
    var corner4 = vec2.fromValues(window.innerWidth, window.innerHeight);
    var radius = Math.max(
      vec2.distance(center, corner1),
      vec2.distance(center, corner2),
      vec2.distance(center, corner3),
      vec2.distance(center, corner4)
    ) + 5;

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

    return Promise.all([
      animate.to(data, total, { r1: radius, delay: 0, onUpdate: draw, ease: Circ.easeInOut }),
      animate.to(data, total, { r2: radius, delay: 0 + smallGap, onUpdate: draw, ease: Circ.easeInOut }),
      animate.to(data, total, { r3: radius, delay: largeGap, onUpdate: draw, ease: Circ.easeInOut }),
      animate.to(data, total, { r4: radius, delay: largeGap + smallGap, onUpdate: draw, ease: Circ.easeInOut }),
      animate.to(data, lastDuration, { r5: radius, delay: lastStart, onUpdate: draw, ease: Circ.easeInOut })
    ]).then(animateComplete);
  }

  function fadeIn() {
    return animate.to(viewportElement, 0.8, {
      opacity: 1,
      ease: Circ.easeOut
    }).then(animateComplete);
  }

  function animateComplete() {
    if (useHiddenWebkitMask) {
      removeMask();
    }
  }

  function fadeOut() {
    return animate.to(viewportElement, 0.8, {
      opacity: 0,
      ease: Circ.easeOut
    }).then(animateComplete);
  }

  function init(viewportElement_) {
    viewportElement = viewportElement_;
    if (useHiddenWebkitMask) {
      ctx = document.getCSSCanvasContext('2d', 'wipe', window.innerWidth, window.innerHeight);
      ctx.fillStyle = 'black';
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      viewportElement.classList.add(maskClass);
      viewportElement.style.webkitMaskPosition = `0 ${window.scrollY}px`;
    } else {
      viewportElement.style.opacity = 0;
    }
  }

  function removeMask() {
    viewportElement.classList.remove(maskClass);
  }

  return {
    init,
    animateIn,
    animateOut
  };
};
