var animate = require('app/util/animate');
var {Promise} = require('es6-promise');
var zIndexes = require('app/util/zIndexes');

module.exports = (function() {
  'use strict';

  /**
   * Contains a visualizer view.
   * @param {AudioManager} audioManager - The shared audioManager.
   * @param {Element} elementToMimic_ - The element to watch for our dimensions.
   * @param {Element} viewportElement - The root experiment element.
   * @constructor
   */
  return function VisualizerContainer(audioManager, elementToMimic_, viewportElement) {
    var pid;

    var wrapperElement;

    var elementToMimic = elementToMimic_;
    var elemRect = { top: 0, left: 0, width: 0, height: 0 };
    var isHidden = false;
    var isPaused = false;

    var subView, canvas;

    var isReady = false;

    function init(pid_, SubView) {
      pid = pid_;

      createRenderer();

      subView = new SubView(audioManager, canvas);
      subView.init();
      wrapperElement.appendChild(canvas);

      isReady = true;
    }

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

    function setPos(x, y) {
      TweenMax.set(wrapperElement, { x, y });
    }

    function resize() {
      if (!isReady) {
        return;
      }

      var { top, left, width, height } = elementToMimic.getBoundingClientRect();
      elemRect.top = top + window.scrollY;
      elemRect.left = left + window.scrollX;
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

    function render(delta) {
      if (isHidden || !isReady || isPaused) { return; }
      subView.render(delta);
    }

    function enable() {
      if (!isReady || isPaused) { return; }
      isPaused = false;
    }

    function disable() {
      if (!isReady || !isPaused) { return; }
      isPaused = true;
    }

    var buffer = 15;
    function hiddenPosition() {
      if (isHidden === 'top') {
        return window.scrollY - elemRect.height - buffer;
      } else {
        return window.scrollY + window.innerHeight + buffer;
      }
    }

    function hide(direction) {
      if (!isReady) {
        return Promise.resolve(true);
      }

      isHidden = direction;

      return animate.to(wrapperElement, 0.3, {
        y: hiddenPosition()
      });
    }

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
