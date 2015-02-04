var PIXI = require('pixi.js/bin/pixi.dev.js');
var animate = require('app/util/animate');
var trackEvent = require('app/util/trackEvent');
var {Promise} = require('es6-promise');
var backImage = require('url?limit=10000!app/images/back-arrow.png');
var RecordButton = require('app/views/RecordButton');
var zIndexes = require('app/util/zIndexes');
var currentViewportDetails = require('app/util/currentViewportDetails');

module.exports = (function() {
  'use strict';

  const MAX_CONTENT_WIDTH = 1024;
  const CONTENT_ASPECT_RATIO_HORIZONTAL = 2 / 1;
  const CONTENT_ASPECT_RATIO_VERTICAL = 2 / 3;
  const CONTENT_HORIZONTAL_BUFFER_DESKTOP = 64;
  const CONTENT_HORIZONTAL_BUFFER_MOBILE = 24;
  const CONTENT_VERTICAL_BUFFER_DESKTOP = 150;
  const CONTENT_VERTICAL_BUFFER_MOBILE = 32;
  const CONTENT_CONTROLS_BUFFER = 70;
  const MOBILE_MAX = 767;

  // Pixi.js has too many retina bugs to enable at this time.
  var isRetina = false;

  var renderers;

  /**
   * WebGL can never clean up after old contexts, so we reuse ours in a pool.
   */
  function buildRendererPool() {
    var antialias = true;
    var resolution = 1;

    if (isRetina) {
      antialias = false;
      resolution = 2;
    }

    if (window.navigator.userAgent.match(/Safari/) &&
        window.navigator.userAgent.match(/Version\/8/)) {
      antialias = false;
    }

    renderers = [];

    for (let i = 0; i < 5; i++) {
      renderers.push(new PIXI.WebGLRenderer(window.innerWidth, window.innerHeight, {
        antialias: antialias,
        transparent: false,
        resolution: resolution
      }));
    }
  }

  /**
   * Get a renderer from the pool.
   * @return {PIXI.WebGLRenderer}
   */
  function getRenderer() {
    return renderers.pop();
  }

  /**
   * Return a renderer to the pool.
   * @param {PIXI.WebGLRenderer} renderer - The no longer used renderer.
   */
  function returnRenderer(renderer) {
    renderers.push(renderer);
  }

  /**
   * A container that wraps a sub instruments.
   * @param {AudioManager} audioManager - The shared audioManager.
   * @param {Element} elementToMimic_ - The element to watch for our dimensions.
   * @param {Element} viewportElement - The root experiment element.
   * @constructor
   */
  return function InstrumentContainer(audioManager, elementToMimic_, viewportElement) {
    var stage, renderer;
    var pid;

    var displayContainerCenter;
    var displayContainer;
    var displayContainerSub;
    var controls;
    var expandedAt;
    var wrapperElement;

    var elementToMimic = elementToMimic_;
    var hasTopMargin = !elementToMimic.classList.contains('js-experiment-instrument--no-top-margin');
    var hasBottomMargin = !elementToMimic.classList.contains('js-experiment-instrument--no-bottom-margin');

    var elemRect = { top: 0, left: 0, width: 0, height: 0 };

    var tweenData = { width: 0, height: 0, optimalWidth: 0, optimalHeight: 0 };

    var isReady = false;
    var isExpanded = false;
    var isPaused = false;

    var instrumentView;
    var controlsBG, backIcon, backIconContainer, recordButton, debugFrame;

    var onActivateCallback_;
    var onBackCallback_;

    var isMobile = false;

    if (!renderers) {
      buildRendererPool();
    }

    var self = {
      init,
      enable,
      disable,
      render,
      resize,
      expandView,
      contractView,
      ignoreInteraction,
      followInteraction,
      onActivate,
      onBack,
      cleanUp,
      getView: () => instrumentView,
      getElemRect: () => elemRect,
      getChannel: () => instrumentView && instrumentView.getChannel && instrumentView.getChannel(),
      getPID: () => pid
    };

    /**
     * Initialize the instrument with a subview.
     * @param {number} pid_ - The instrument id.
     * @param {function} SubView - The view contained by this instrument.
     */
    function init(pid_, SubView) {
      pid = pid_;

      displayContainerCenter = new PIXI.DisplayObjectContainer();
      displayContainer = new PIXI.DisplayObjectContainer();
      displayContainerSub = new PIXI.DisplayObjectContainer();
      controls = makeControls();

      instrumentView = new SubView(audioManager);
      createRenderer(instrumentView.backgroundColor);

      displayContainer.addChild(displayContainerSub);
      displayContainerSub.addChild(displayContainerCenter);

      stage.addChild(displayContainer);

      instrumentView.init(stage, pid, displayContainerCenter, renderer);

      // If Debug
      // debugFrame = new PIXI.Graphics();
      // displayContainer.addChild(debugFrame);

      addMask();

      stage.interactive = true;
      addContractedEventListeners();

      isReady = true;

      setTimeout(function() {
        // fixes for black graphic squares in 5th webGL container
        var recordIconImage = recordButton.recordIcon;
        var recordCircle = recordButton.circle;
        var checkboxCircle = recordButton.checkmarkCircle;
        var recordText = recordButton.textImages;
        var recordNumbers = recordButton.numberImagePixiObjects;
        renderer.updateTexture(backIcon.texture.baseTexture);
        renderer.updateTexture(recordIconImage.texture.baseTexture);
        renderer.updateTexture(recordCircle.texture.baseTexture);
        renderer.updateTexture(checkboxCircle.texture.baseTexture);
        for (let i = 0; i < recordText.length; i++) {
          renderer.updateTexture(recordText[i].texture.baseTexture);
        }
        for (let i = 0; i < recordNumbers.length; i++) {
          renderer.updateTexture(recordNumbers[i].texture.baseTexture);
        }
      }, 50);
    }

    /**
     * Build the control views.
     */
    function makeControls() {
      controlsBG = new PIXI.Graphics();

      backIcon = new PIXI.Sprite.fromImage(backImage);
      backIcon.position.x = 20;
      backIcon.position.y = 20;

      backIconContainer = new PIXI.DisplayObjectContainer();
      backIconContainer.hitArea = new PIXI.Rectangle(0, 0, 56, 56);
      backIconContainer.addChild(backIcon);
      backIconContainer.alpha = 0;

      recordButton = new RecordButton(audioManager);
      recordButton.container.position.x = window.innerWidth - 62;
      recordButton.container.position.y = 56;
      recordButton.container.pivot.set(28,28);
      recordButton.container.scale.x = 0;
      recordButton.container.scale.y = 0;
      recordButton.onCountdownActivate(onCountdownActivate);
      recordButton.onRecordActivate(onRecordActivate);
      recordButton.onRecordDeactivate(onRecordDeactivate);

      var controlContainer = new PIXI.DisplayObjectContainer();
      controlContainer.addChild(controlsBG);
      controlContainer.addChild(backIconContainer);
      controlContainer.addChild(recordButton.container);

      controlContainer.position.y = -100;

      resizeControls(window.innerWidth);

      return controlContainer;
    }

    /**
     * Resize the controls.
     * @param {number} width - The new width.
     */
    function resizeControls(width) {
      var rect = new PIXI.Rectangle(0, 0, width, 56);
      controlsBG.clear();
      controlsBG.beginFill(0x000000, 0.1);
      controlsBG.drawShape(rect);
      recordButton.container.position.x = window.innerWidth - 62;
    }

    /**
     * Animate the controls in.
     * @return {Promise}
     */
    function showControls() {
      stage.addChild(controls);

      backIconContainer.interactive = true;
      backIconContainer.buttonMode = true;

      return animate.to(controls, 0.3, {
        y: 0,
        delay: 0
      }).then(function() {
        animate.to(backIconContainer, 0.1, {
          alpha: 1
        });
        animate.to(recordButton.container.scale, 0.33, {
          x: 1,
          y: 1,
          ease: Back.easeOut
        });
      });
    }

    /**
     * Animate the controls out.
     * @param {number} delay - Animation delay.
     * @return {Promise}
     */
    function hideControls(delay) {
      backIconContainer.interactive = false;
      backIconContainer.buttonMode = false;
      backIconContainer.click = null;

      return animate.to(controls, 0.2, {
        y: -100,
        delay: delay
      }).then(function() {
        stage.addChild(controls);
        animate.set(backIconContainer, {
          alpha: 0
        });
        animate.set(recordButton.container.scale, {
          x: 0,
          y: 0
        });
      });
    }

    /**
     * Activate countdown
     */
    function onCountdownActivate() {
      if ('function' === typeof instrumentView.startCountdown) {
        instrumentView.startCountdown();
      }
      backIconContainer.interactive = false;
      animate.to(backIconContainer, 0.33, {
        alpha: 0
      });
      document.removeEventListener('keyup', onGlobalKeyUp);
    }

    /**
     * Activate record button
     */
    function onRecordActivate() {
      if ('function' === typeof instrumentView.startRecording) {
        instrumentView.startRecording();
      }
    }

    /**
     * Deactivate record button
     */
    function onRecordDeactivate() {
      if ('function' === typeof instrumentView.stopRecording) {
        instrumentView.stopRecording();
        backIconContainer.interactive = true;
        animate.to(backIconContainer, 0.33, {
          alpha: 1
        });
        document.addEventListener('keyup', onGlobalKeyUp);
      }

      logRecorded();
    }

    /**
     * When finished recording, console.table the new data so
     * developers can get an idea of the data.
     */
    function logRecorded() {
      if (!console || !console.table) { return; }

      var data = instrumentView.getData();
      if (data.recorded.length <= 0) { return; }

      var output = [
        data.recorded[0].keys
      ];

      output = output.concat(data.recorded.map(r => r.serializeModel()));

      // Purposefully left in for user insight into our data structures.
      console.table(output);
    }

    /**
     * Create the PIXI rendered with a given background color.
     * @param {number} bgColor - The color.
     */
    function createRenderer(bgColor) {
      wrapperElement = document.createElement('div');
      wrapperElement.classList.add('experiment-instrument');
      wrapperElement.classList.add('experiment-instrument--' + pid);
      viewportElement.appendChild(wrapperElement);

      // create a renderer passing in the options
      renderer = getRenderer();

      if (isRetina) {
        animate.set(renderer.view, { scaleX: 0.5, scaleY: 0.5 });
        renderer.view.style.transformOrigin = '0 0';
        renderer.view.style.webkitTransformOrigin = '0 0';
      }

      stage = new PIXI.Stage(bgColor);

      resize(window.innerWidth, window.innerHeight);

      wrapperElement.appendChild(renderer.view);

      stage.addChild(displayContainerCenter);
    }

    /**
     * Clean on shutodwn.
     */
    function cleanUp() {
      if ('function' === typeof instrumentView.cleanUp) {
        instrumentView.cleanUp();
      }

      returnRenderer(renderer);
      renderer = null;
    }

    /**
     * Get the current scroll.
     * @return {number}
     */
    function getDocumentScrollTop() {
      return currentViewportDetails().y;
    }

    /**
     * When the container is activated.
     * @param {function} cb - The callback.
     */
    function onActivate(cb) {
      onActivateCallback_ = cb;
    }

    /**
     * When the container is deactivated.
     * @param {function} cb - The callback.
     */
    function onBack(cb) {
      onBackCallback_ = cb;
    }

    /**
     * Add listeners for when the view is contracted.
     */
    function addContractedEventListeners() {
      displayContainer.interactive = true;
      displayContainer.buttonMode = true;
      displayContainer.mousedown = function() {
        onActivateCallback_(self);
      };
    }

    /**
     * Remove listeners for when the view is contracted.
     */
    function removeContractedEventListeners() {
      displayContainer.interactive = false;
      displayContainer.buttonMode = false;
      displayContainer.click = null;
    }

    /**
     * Add listeners for when the view is expanded.
     */
    function addExpandedEventListeners() {
      backIconContainer.click = backIconContainer.tap = function() {
        onBackCallback_(self);
      };

      document.addEventListener('keyup', onGlobalKeyUp);
    }

    function onGlobalKeyUp(evt) {
      evt = evt || window.event;
      if (evt.keyCode === 27) {
        onBackCallback_(self);
      }
    }

    /**
     * Remove listeners for when the view is expanded.
     */
    function removeExpandedEventListeners() {
      backIconContainer.click = backIconContainer.tap = null;
      document.removeEventListener('keyup', onGlobalKeyUp);
    }

    /**
     * Expand this view.
     * @return {Promise}
     */
    function expandView() {
      isExpanded = true;

      expandedAt = +(new Date());
      trackEvent('sectionview', '' + instrumentView.name + ' entered');

      wrapperElement.style.zIndex = zIndexes.ACTIVE;

      var duration = 0.5;

      var moveView = animate.to(wrapperElement, duration, {
        x: 0,
        y: getDocumentScrollTop()
      });

      var targetY = (window.innerHeight / 2) + getMarginOffset();

      var moveCenter = animate.to(displayContainerCenter, duration, {
        x: window.innerWidth / 2,
        y: targetY
      });

      var [optimalWidth, optimalHeight] = optimalBounds(window.innerWidth, window.innerHeight);

      var scaleView = animate.to(tweenData, duration, {
        width: window.innerWidth,
        height: window.innerHeight,
        optimalWidth: optimalWidth,
        optimalHeight: optimalHeight,
        onUpdate: updateDimensions
      });

      instrumentView.animationExpanded();
      removeContractedEventListeners();
      addExpandedEventListeners();

      return Promise.all([
        moveView,
        moveCenter,
        scaleView
      ]).then(function() {
        recordButton.addEventListeners();
        return showControls();
      });
    }

    /**
     * Calculate the margins of the instrument box.
     * @return {number}
     */
    function getMarginOffset() {
      var isFirst = pid === 0;

      if (isExpanded) {
        return instrumentView.supportsPortrait ? (CONTENT_CONTROLS_BUFFER / 2) : 0;
      } else {
        if (isMobile) {
          return isFirst ? (CONTENT_CONTROLS_BUFFER / 2) : 0;
        } else {
          var equalMargins = Math.floor(CONTENT_VERTICAL_BUFFER_DESKTOP / 3);
          return (hasTopMargin ? equalMargins : 0) - (hasBottomMargin ? equalMargins : 0);
        }
      }
    }

    /**
     * Contract this view.
     * @return {Promise}
     */
    function contractView() {
      isExpanded = false;

      trackEvent('time-' + instrumentView.name, +(new Date()) - expandedAt);

      var duration = 0.5;

      var moveView = animate.to(wrapperElement, duration, {
        x: elemRect.left,
        y: elemRect.top
      });

      var targetY = (elemRect.height / 2) + getMarginOffset();

      var moveCenter = animate.to(displayContainerCenter, duration, {
        x: elemRect.width / 2,
        y: targetY
      });

      var [optimalWidth, optimalHeight] = optimalBounds(elemRect.width, elemRect.height);

      var scaleView = animate.to(tweenData, duration, {
        width: elemRect.width,
        height: elemRect.height,
        optimalWidth: optimalWidth,
        optimalHeight: optimalHeight,
        onUpdate: updateDimensions
      });

      instrumentView.animationCollapsed();
      removeExpandedEventListeners();
      addContractedEventListeners();

      hideControls();
      recordButton.removeEventListeners();

      return Promise.all([
        moveView,
        moveCenter,
        scaleView
      ]).then(function() {
        wrapperElement.style.zIndex = zIndexes.BOTTOM;
      });
    }

    /**
     * Disable this view.
     */
    function disable() {
      if (!isReady || isPaused) { return; }

      isPaused = true;
      instrumentView.disable();
    }

    /**
     * Enable this view.
     */
    function enable() {
      if (!isReady || !isPaused) { return; }

      isPaused = false;
      instrumentView.enable();
    }

    /**
     * On tween update of view dimensions.
     */
    function updateDimensions() {
      wrapperElement.style.width = tweenData.width + 'px';
      wrapperElement.style.height = tweenData.height + 'px';
      displayContainer.hitArea = new PIXI.Rectangle(0, 0, tweenData.width, tweenData.height);

      updateDebugFrame(tweenData.optimalWidth, tweenData.optimalHeight);

      instrumentView.resize(tweenData.width, tweenData.height, tweenData.optimalWidth, tweenData.optimalHeight);
    }

    /**
     * Given an aspect ratio, fit a rectangle inside a container.
     * @param {number} ratio - The aspect ratio.
     * @param {number} w - The container width.
     * @param {number} h - The container height.
     * @return {array<number>}
     */
    function fitBounds(ratio, w, h) {
      var wNew = ratio / Math.max(ratio / w, 1 / h);
      var hNew = 1 / Math.max(ratio / w, 1 / h);

      return [wNew, hNew];
    }

    /**
     * Calculate a nice bounding box based on screen size.
     * @param {number} containerWidth - The width.
     * @param {number} containerHeight - The height.
     * @return {array<number>}
     */
    function optimalBounds(containerWidth, containerHeight) {
      var isFirst = pid === 0;

      var optimalWidth;
      var optimalHeight;

      var horizontalBuffer = isMobile ?
          CONTENT_HORIZONTAL_BUFFER_MOBILE :
          CONTENT_HORIZONTAL_BUFFER_DESKTOP;
      var verticalBuffer = isMobile ?
          CONTENT_VERTICAL_BUFFER_MOBILE :
          CONTENT_VERTICAL_BUFFER_DESKTOP;

      var isPortrait = isMobile && instrumentView.supportsPortrait && (containerHeight > containerWidth);

      if (isExpanded) {
        verticalBuffer = CONTENT_CONTROLS_BUFFER;

        if (isPortrait) {
          horizontalBuffer *= 2;
        }
      }

      var relativeWidth = (containerWidth - (horizontalBuffer * 2));
      var relativeHeight;

      if (isMobile) {
        let topBuffer = (isExpanded || isFirst) ? Math.max(CONTENT_CONTROLS_BUFFER, verticalBuffer) : verticalBuffer;
        relativeHeight = containerHeight - (topBuffer * 2);

        if (isPortrait) {
          return fitBounds(CONTENT_ASPECT_RATIO_VERTICAL, relativeWidth, relativeHeight);
        } else {
          return fitBounds(CONTENT_ASPECT_RATIO_HORIZONTAL, relativeWidth, relativeHeight);
        }
      } else {
        relativeHeight = containerHeight;

        let topBuffer;
        if (hasTopMargin) {
          topBuffer = verticalBuffer;
        } else {
          topBuffer = CONTENT_VERTICAL_BUFFER_MOBILE;
        }

        topBuffer = (isExpanded || (isMobile && isFirst)) ? Math.max(CONTENT_CONTROLS_BUFFER, topBuffer) : topBuffer;
        relativeHeight -= topBuffer;

        if (hasBottomMargin) {
          relativeHeight -= verticalBuffer;
        } else {
          relativeHeight -= CONTENT_VERTICAL_BUFFER_MOBILE;
        }

        var minWidth = Math.min(MAX_CONTENT_WIDTH, relativeWidth);

        return fitBounds(CONTENT_ASPECT_RATIO_HORIZONTAL, minWidth, relativeHeight);
      }

      return [optimalWidth, optimalHeight];
    }

    /**
     * Set the container position.
     * @param {number} x - The x position.
     * @param {number} y - The y position.
     */
    function setPos(x, y) {
      animate.set(wrapperElement, { x, y });
    }

    /**
     * Add the mask element to the DOM.
     */
    function addMask() {
      wrapperElement.style.top = '0px';
      wrapperElement.style.left = '0px';
      wrapperElement.style.width = elemRect.width + 'px';
      wrapperElement.style.height = elemRect.height + 'px';
      setPos(elemRect.left, elemRect.top);
    }

    /**
     * On-resize of the window.
     * @param {number} w - The width.
     * @param {number} h - The height.
     */
    function resize(w, h) {
      if (!isReady) { return; }
      isMobile = window.innerWidth <= MOBILE_MAX;

      var { top, left, width, height } = elementToMimic.getBoundingClientRect();
      var { x, y } = currentViewportDetails();

      elemRect.top = top + y;
      elemRect.left = left + x;
      elemRect.width = width;
      elemRect.height = height;

      var maxW = Math.max(w, elemRect.width);
      var maxH = Math.max(h, elemRect.height);

      renderer.resize(maxW, maxH);

      resizeControls(window.innerWidth);

      if (isExpanded) {
        setPos(0, getDocumentScrollTop());
        wrapperElement.style.width = window.innerWidth + 'px';
        wrapperElement.style.height = window.innerHeight + 'px';

        displayContainerCenter.position.y = ~~(window.innerHeight / 2) + getMarginOffset();
        displayContainerCenter.position.x = ~~(window.innerWidth / 2);

        let [optimalWidth, optimalHeight] = optimalBounds(window.innerWidth, window.innerHeight);

        tweenData.width = window.innerWidth;
        tweenData.height = window.innerHeight;
        tweenData.optimalWidth = optimalWidth;
        tweenData.optimalHeight = optimalHeight;

        instrumentView.resize(w, h, optimalWidth, optimalHeight);
        updateDebugFrame(optimalWidth, optimalHeight);

        displayContainer.hitArea = new PIXI.Rectangle(0, 0, w, h);
      } else {
        displayContainerCenter.position.y = Math.floor(elemRect.height / 2);
        displayContainerCenter.position.y += getMarginOffset();

        displayContainerCenter.position.x = Math.floor(elemRect.width / 2);

        setPos(elemRect.left, elemRect.top);
        wrapperElement.style.width = elemRect.width + 'px';
        wrapperElement.style.height = elemRect.height + 'px';

        let [optimalWidth, optimalHeight] = optimalBounds(elemRect.width, elemRect.height);

        tweenData.width = elemRect.width;
        tweenData.height = elemRect.height;
        tweenData.optimalWidth = optimalWidth;
        tweenData.optimalHeight = optimalHeight;

        instrumentView.resize(elemRect.width, elemRect.height, optimalWidth, optimalHeight);

        updateDebugFrame(optimalWidth, optimalHeight);

        displayContainer.hitArea = new PIXI.Rectangle(0, 0, elemRect.width, elemRect.height);
      }
    }

    /**
     * Update the size of the optimalBounds frame for debugging.
     * @param {number} optimalWidth - The bounds width.
     * @param {number} optimalHeight - The bounds height.
     */
    function updateDebugFrame(optimalWidth, optimalHeight) {
      if (!debugFrame) { return; }

      debugFrame.position.x = displayContainerCenter.position.x;
      debugFrame.position.y = displayContainerCenter.position.y;

      debugFrame.clear();
      debugFrame.beginFill(0x000000, 0.2);

      var rect = new PIXI.Rectangle(-optimalWidth / 2, -optimalHeight / 2, optimalWidth, optimalHeight);
      debugFrame.drawShape(rect);
    }

    /**
     * Animation tick.
     * @param {number} delta - rAF delta.
     */
    function render(delta) {
      if (!isReady || isPaused) { return; }

      instrumentView.render(delta);
      renderer.render(stage);

      if (isExpanded) {
        recordButton.render(delta);
      }
    }

    /**
     * Stop interaction tracking.
     */
    function ignoreInteraction() {
      stage.interactive = false;
    }

    /**
     * Start interaction tracking.
     */
    function followInteraction() {
      stage.interactive = true;
    }

    return self;
  };
})();
