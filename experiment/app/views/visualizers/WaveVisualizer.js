const LINE_COLOR = '#BDBDBD';
const LINE_WIDTH = 1;
const FFT_SIZE = 64;
const SMOOTHING_TIME_CONSTANT = 0.9;
const SEGMENTS = 10;

var PIXI = require('pixi.js/bin/pixi.dev.js');
var curve = require('vendor/curve_func');

var animate = require('app/util/animate');

/**
 * Create analyser node for wave visualisation.
 * @param {Object} audioManager - The audio manager.
 * @param {element} canvas - The canvas upon which to draw.
 * @return {Object} self
 */
module.exports = function WaveVisualizer(audioManager, canvas) {
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

  analyser.fftSize = FFT_SIZE;
  var freqDomain = new Uint8Array(analyser.frequencyBinCount);

  var amplitude = 20;

  var xMax = canvas.width;
  var yMax = canvas.height;

  var renderReady = false;

  var points = [];
  var splinePoints = [];
  var splineTween = [];
  var lastsplineTween = [];
  var intervalID;
  var factor = 1;

  function init() {
    pops();
    intervalID = window.setInterval(pops , 300);
  }

  function pops() {
    createPoints();

    for(var i = 0; i < splinePoints.length; i++) {
      tweenById(i);
    }
  }

  function tweenById(id) {
    splineTween[id] = splinePoints[id];
    var object = {};
    if (lastsplineTween[id]) {
      object.radius = lastsplineTween[id];
      lastsplineTween[id] = splineTween[id];
    } else {
      // object.radius = 100;
      lastsplineTween[id] = splineTween[id];
    }
    // animate.killTweensOf( object )
    animate.to(object, 0.3, { radius:splinePoints[id], onUpdate:tweenByIdUpdate, onUpdateParams: [object, id]});
  }

  function tweenByIdUpdate(object, id) {
    splineTween[id] = object.radius;
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

    analyser.fftSize = FFT_SIZE;
    analyser.getByteFrequencyData(freqDomain);
    analyser.smoothingTimeConstant = SMOOTHING_TIME_CONSTANT;
    // createPoints();

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
    var xs = point2.x - point1.x;
    var ys = point2.y - point1.y;
    var stepx = xs/SEGMENTS;
    var stepy = ys/SEGMENTS;

    for (var i = 0; i < SEGMENTS + 1; i++) {
      points[i].x = point1.x + (stepx * i);
      points[i].y = point1.y + (stepy * i);
      amplitude = freqDomain[i];
      points[i].y =  points[i].y + (Math.random() * (amplitude)) * factor;

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

      splinePoints.push(points[i].x);
      splinePoints.push(points[i].y);
    }
  }

  function createPoints() {
    points = [];
    splinePoints = [];
    points[0] = new PIXI.Point(-1, yMax / 2);
    for (let i = 0; i <= SEGMENTS; i++) {
      points.push(new PIXI.Point(0, yMax / 2));
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
