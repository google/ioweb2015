var animate = require('app/util/animate');

module.exports = (function() {
  'use strict';

  const LINE_COLOR = '#BDBDBD';
  const LINE_WIDTH = 2;
  const MIN_DECIBELS = -150;
  const MAX_DECIBELS = 0;
  const SMOOTHING_TIME_CONSTANT = 0.9;
  const FFT_SIZE = 128;
  const PERCENT_VALUE = 256;

  /**
   * Create analyser node for bar visualisation.
   * @param {Object} audioManager - The audio manager.
   * @param {element} canvas - The canvas upon which to draw.
   * @constructor
   */
  return function BarVisualizer(audioManager, canvas) {
    var self = {
      render,
      resize,
      enable,
      init,
      disable
    };

    var analyser = audioManager.analyser;
    analyser.smoothingTimeConstant = SMOOTHING_TIME_CONSTANT;
    analyser.fftSize = FFT_SIZE;

    var canvasContext = canvas.getContext('2d');

    analyser.minDecibels = MIN_DECIBELS;
    analyser.maxDecibels = MAX_DECIBELS;

    var freqDomain = new Uint8Array(analyser.frequencyBinCount);

    var timeoutID;
    var barSizes = [];
    var barSizeTweens = [];
    var lastBarSizeTweens = [];
    var lastTweenObject = [];

    function init() {
      pops();
    }

    function pops() {
      var inc = 0;
      var direction = 'up';

      for (let i = 0; i < (freqDomain.length * 2); i++) {
        tweenById(i, inc);

        if (inc < 26 && direction  === 'up') {
          inc = inc + 1;
        } else {
          direction = 'down';
          inc = inc - 1;
        }
      }

      timeoutID = window.setTimeout(pops, 200);
    }

    /**
     * Draw bars to canvas based on audio frequency data.
     */
    function drawBars() {
      var canvasWidth = canvas.width;
      var canvasHeight = canvas.height;

      canvasContext.fillStyle = 'white';
      canvasContext.fillRect(0, 0, canvasWidth, canvasHeight);

      analyser.getByteFrequencyData(freqDomain);

      var inc = 0;
      var direction = 'up';

      for (let i = 0; i < (freqDomain.length * 2); i++) {
        let value = barSizeTweens[i];
        let percent = value / PERCENT_VALUE;
        let height = canvasHeight * percent;
        let offset = canvasHeight - height;
        let barWidth = LINE_WIDTH;

        canvasContext.fillStyle = LINE_COLOR;
        canvasContext.fillRect((i + 1) * 5 * LINE_WIDTH, offset, barWidth, height);

        if ((inc < 26) && (direction === 'up')) {
          inc = inc + 1;
        } else {
          direction = 'down';
          inc = inc - 1;
        }
      }
    }

    function tweenById(id, inc) {
      barSizes[id] = freqDomain[inc];

      if (!lastTweenObject[id]) {
        lastTweenObject[id] = [
          { height: 0 },
          { height: 0, onUpdate: tweenByIdUpdate, onUpdateParams: [id] }
        ];
      }

      if (lastBarSizeTweens[id]) {
        lastTweenObject[id][0].height = lastBarSizeTweens[id];
        lastBarSizeTweens[id] = barSizes[id];
      } else {
        lastTweenObject[id][0].height = 100;
        lastBarSizeTweens[id] = barSizes[id];
      }

      lastTweenObject[id][1].height = barSizes[id];
      animate.to(lastTweenObject[id][0], 0.2, lastTweenObject[id][1]);
    }

    function tweenByIdUpdate(id) {
      barSizeTweens[id] = lastTweenObject[id][0].height;
    }

    /**
     * On render, draw bars
     */
    function render() {
      drawBars();
    }

    /**
     * On resize, draw bars
     */
    function resize() {
      drawBars();
    }

    /**
     * Enable visualizer
     */
    function enable() {}

    /**
     * Disable visualizer
     */
    function disable() {}

    return self;
  };
})();
