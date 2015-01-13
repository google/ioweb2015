const LINE_COLOR = '#BDBDBD';
const LINE_WIDTH = 2;
const MIN_DECIBELS = -150;
const MAX_DECIBELS = 0;
const SMOOTHING_TIME_CONSTANT = 0.9;
const FFT_SIZE = 128;
const PERCENT_VALUE = 256;

var animate = require('app/util/animate');

/**
 * Create analyser node for bar visualisation.
 * @param {Object} audioManager - The audio manager.
 * @param {element} canvas - The canvas upon which to draw.
 * @return {Object} self
 */
module.exports = function BarVisualizer(audioManager, canvas) {
  'use strict';

  var self = {
    render,
    resize,
    enable,
    init,
    disable
  };

  var analyser = audioManager.analyser;
  var canvasContext = canvas.getContext('2d');

  analyser.minDecibels = MIN_DECIBELS;
  analyser.maxDecibels = MAX_DECIBELS;

  var freqDomain = new Uint8Array(analyser.frequencyBinCount);

  var intervalID;

  function init() {
    pops();
    intervalID = window.setInterval(pops , 200);
  }

  function pops() {
    var inc = 0;
    var direction = 'up';
    for(var i = 0; i < freqDomain.length*2; i++) {
      tweenById(i, inc);

      if (inc < 26 && direction  === 'up') {
        inc = inc + 1;
      } else {
        direction = 'down';
        inc = inc - 1;
      }
    }
  }
  var iconSizes = [];
  var iconSizesTween = [];
  var lasticonSizesTween = [];

  /**
   * Draw bars to canvas based on audio frequency data.
   */
  function drawBars() {
    var canvasWidth = canvas.width;
    var canvasHeight = canvas.height;

    canvasContext.fillStyle = 'white';
    canvasContext.fillRect(0, 0, canvasWidth, canvasHeight);

    analyser.smoothingTimeConstant = SMOOTHING_TIME_CONSTANT;
    analyser.fftSize = FFT_SIZE;
    analyser.getByteFrequencyData(freqDomain);

    // draw the bars
    var inc = 0;
    var direction = 'up';

    for(var i = 0; i < freqDomain.length*2; i++) {

      var value = iconSizesTween[i];
      var percent = value / PERCENT_VALUE;

      var height = canvasHeight * percent;
      var offset = canvasHeight - height;
      var barWidth = LINE_WIDTH;
      canvasContext.fillStyle = LINE_COLOR;
      canvasContext.fillRect((i+1) * 5 * LINE_WIDTH, offset, barWidth, height);

      if ( inc < 26 && direction  === 'up') {
        inc = inc + 1;
      } else {
        direction = 'down';
        inc = inc - 1;
      }
    }
  }

  function tweenById(id, inc) {
    iconSizes[id] = freqDomain[inc];
    var object = {};
    if (lasticonSizesTween[id]) {
      object.radius = lasticonSizesTween[id];
      lasticonSizesTween[id] = iconSizes[id];
    } else {
      object.radius = 100;
      lasticonSizesTween[id] = iconSizes[id];
    }
    animate.to(object, 0.2, { radius:iconSizes[id], onUpdate:tweenByIdUpdate, onUpdateParams: [object, id]});
  }

  function tweenByIdUpdate(object, id) {
    iconSizesTween[id] = object.radius;
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
