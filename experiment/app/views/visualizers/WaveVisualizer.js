var PIXI = require('pixi.js/bin/pixi.dev.js');
var animate = require('app/util/animate');
var curve = require('vendor/curve_func');

module.exports = (function() {
  'use strict';

  const LINE_COLOR = '#BDBDBD';
  const LINE_WIDTH = 1;
  const FFT_SIZE = 64;
  const SMOOTHING_TIME_CONSTANT = 0.9;
  const SEGMENTS = 10;

  /**
   * Create analyser node for wave visualisation.
   * @param {Object} audioManager - The audio manager.
   * @param {element} canvas - The canvas upon which to draw.
   * @return {Object} self
   */
  return function WaveVisualizer(audioManager, canvas) {
    var self = {
      render,
      resize,
      enable,
      init,
      disable
    };

    var analyser = audioManager.analyser;
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = SMOOTHING_TIME_CONSTANT;

    var canvasContext = canvas.getContext('2d');

    var freqDomain = new Uint8Array(analyser.frequencyBinCount);

    var amplitude = 20;

    var xMax = canvas.width;
    var yMax = canvas.height;

    var renderReady = false;

    var points = [];
    var splinePoints = [];
    var splineTween = [];
    var lastSplineTween = [];
    var lastTweenObject = [];
    var timeoutID;
    var factor = 1;

    function init() {
      pops();
    }

    function pops() {
      createPoints();

      for (let i = 0; i < splinePoints.length; i++) {
        tweenById(i);
      }

      timeoutID = window.setTimeout(pops, 300);
    }
    function tweenById(id) {
      splineTween[id] = splinePoints[id];

      if (!lastTweenObject[id]) {
        lastTweenObject[id] = [
          { radius: 0 },
          { radius: 0, onUpdate: tweenByIdUpdate, onUpdateParams: [id] }
        ];
      }

      if (lastSplineTween[id]) {
        lastTweenObject[id][0].radius = lastSplineTween[id];
        lastSplineTween[id] = splinePoints[id];
      } else {
        lastSplineTween[id] = splinePoints[id];
      }

      lastTweenObject[id][1].radius = splinePoints[id];
      animate.to(lastTweenObject[id][0], 0.3, lastTweenObject[id][1]);
    }

    function tweenByIdUpdate(id) {
      splineTween[id] = lastTweenObject[id][0].radius;
    }

    /**
     * Draw oscillating wave to canvas
     */
    function drawWave() {
      var canvasWidth = canvas.width;
      var canvasHeight = canvas.height;

      xMax = canvasWidth;
      yMax = canvasHeight;
      canvasContext.clearRect(0, 0, xMax, yMax);

      analyser.getByteFrequencyData(freqDomain);

      canvasContext.lineWidth = LINE_WIDTH;
      canvasContext.strokeStyle = LINE_COLOR;
      canvasContext.fillStyle = 'white';
      canvasContext.fillRect(0, 0, xMax, yMax);

      if (renderReady === true) {
        canvasContext.beginPath();
        curve(canvasContext, splineTween, 0.5);
        canvasContext.stroke();
      }
    }

    /**
     * On render, draw wave
     */
    function render() {
      drawWave();
    }

    /**
     * On resize, draw wave
     */
    function resize() {
      createPoints();
      drawWave();
    }

    function getRun(point1, point2, SEGMENTS) {
      splinePoints.length = 0;

      var xs = point2.x - point1.x;
      var ys = point2.y - point1.y;
      var stepX = xs / SEGMENTS;
      var stepY = ys / SEGMENTS;

      for (let i = 0; i < SEGMENTS + 1; i++) {
        points[i].x = point1.x + (stepX * i);
        points[i].y = point1.y + (stepY * i);
        amplitude = freqDomain[i];
        points[i].y = points[i].y + (Math.random() * (amplitude)) * factor;

        if (factor === 1) {
          factor = -1;
        } else {
          factor = 1;
        }

        if (i === 0 ) {
          points[i].y = yMax/2;
        } else if (i === SEGMENTS) {
          points[i].y = yMax/2;
        }

        var everyOther = i * 2;
        splinePoints[everyOther] = points[i].x;
        splinePoints[everyOther+1] = points[i].y;
      }
    }

    function setPoint(idx, x, y) {
      points[idx] = points[idx] || new PIXI.Point(0, 0);
      points[idx].x = x;
      points[idx].y = y;
    }

    function createPoints() {
      setPoint(0, -1, yMax / 2);

      for (let i = 0; i <= SEGMENTS; i++) {
        setPoint(i + 1, 0, yMax / 2);
      }

      points[SEGMENTS].x = xMax;

      getRun(points[0], points[SEGMENTS], SEGMENTS);

      renderReady = true;
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
