var animate = require('app/util/animate');
var {Promise} = require('es6-promise');
var zIndexes = require('app/util/zIndexes');
var currentScrollPosition = require('app/util/currentScrollPosition');

module.exports = (function() {
  'use strict';

  /**
   * Contains a visualizer view.
   * @param {AudioManager} audioManager - The shared audioManager.
   * @param {Element} elementToMimic_ - The element to watch for our dimensions.
   * @param {Element} viewportElement - The root experiment element.
   * @param {AudioNode} analysers - The audio analysers.
   * @constructor
   */
  return function VisualizerContainer(audioManager, elementToMimic_, viewportElement, analysers) {
    var pid;

    var wrapperElement;

    var elementToMimic = elementToMimic_;
    var elemRect = { top: 0, left: 0, width: 0, height: 0 };
    var isHidden = false;
    var isPaused = false;

    var subView, canvas;

    var isReady = false;

    /**
     * Contains a visualizer view.
     * @param {number} pid_ - The id of the visualizer.
     * @param {function} SubView - Each unique visualizer view.
     */
    function init(pid_, SubView) {
      pid = pid_;

      createRenderer();

      subView = new SubView(audioManager, canvas, analysers);
      subView.init();
      wrapperElement.appendChild(canvas);

      isReady = true;
    }

    /**
     * Create the canvas for each visualizer.
     */
    function createRenderer() {
      wrapperElement = document.createElement('div');
      wrapperElement.style.zIndex = zIndexes.VISUALIZER;
      wrapperElement.classList.add('experiment-visualizer');
      wrapperElement.classList.add('experiment-visualizer--' + pid);
      viewportElement.appendChild(wrapperElement);

      wrapperElement.style.top = '0px';
      wrapperElement.style.left = '0px';

      canvas = document.createElement('canvas');

      resize();
    }

    /**
     * Set the position of each visualizer.
     * @param {number} x - The x position of the visualizer.
     * @param {number} y - The y position of the visualizer.
     */
    function setPos(x, y) {
      animate.set(wrapperElement, { x: Math.floor(x), y: Math.floor(y) });
    }

    /**
     * On resize, resize each visualizer.
     */
    function resize() {
      if (!isReady) {
        return;
      }

      var { top, left, width, height } = elementToMimic.getBoundingClientRect();
      var { x, y } = currentScrollPosition();

      elemRect.top = top + y;
      elemRect.left = left + x;
      elemRect.width = width;
      elemRect.height = height;

      if (isHidden) {
        setPos(elemRect.left, hiddenPosition());
      } else {
        setPos(elemRect.left, elemRect.top);
      }

      canvas.width = elemRect.width;
      canvas.height = elemRect.height;

      wrapperElement.style.width = elemRect.width + 'px';
      wrapperElement.style.height = elemRect.height + 'px';

      subView.resize(canvas.width, canvas.height);
    }

    /**
     * Render
     * @param {number} delta - The delta.
     */
    function render(delta) {
      if (isHidden || !isReady || isPaused) { return; }
      subView.render(delta);
    }

    /**
     * Play the visualizer.
     */
    function enable() {
      if (!isReady || isPaused) { return; }
      isPaused = false;
    }

    /**
     * Pause the visualizer.
     */
    function disable() {
      if (!isReady || !isPaused) { return; }
      isPaused = true;
    }

    /**
     * Set the hidden position of each visualizer.
     */
    var buffer = 15;
    function hiddenPosition() {
      if (isHidden === 'top') {
        return window.scrollY - elemRect.height - buffer;
      } else {
        return window.scrollY + window.innerHeight + buffer;
      }
    }

    /**
     * Hide each visualizer.
     * @param {string} direction - The direction in which to animate out.
     */
    function hide(direction) {
      if (!isReady) {
        return Promise.resolve(true);
      }

      isHidden = direction;

      return animate.to(wrapperElement, 0.3, {
        y: hiddenPosition()
      });
    }

    /**
     * Show each visualizer.
     */
    function show() {
      if (!isReady) {
        return Promise.resolve(true);
      }

      isHidden = false;

      return animate.to(wrapperElement, 0.3, {
        y: elemRect.top,
        delay: 0.2
      });
    }

    return {
      init,
      render,
      resize,
      enable,
      disable,
      hide,
      show,
      getElemRect: () => elemRect,
      isHidden: () => !!isHidden
    };
  };
})();
