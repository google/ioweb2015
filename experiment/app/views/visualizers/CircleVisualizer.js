var p2 = require('p2');

module.exports = (function() {
  'use strict';

  const LINE_WIDTH = 1;
  const FFT_SIZE = 512;
  const SMOOTHING_TIME_CONSTANT = 0.3;
  const PARTICLE_COUNT = 100;
  const PARTICLE_STROKE_WIDTH = 1;
  const PARTICLE_STROKE_COLOR = 'black';
  const PARTICLE_RELATIVE_SIZE = 1 / 5;

  /**
   * Create analyser node for bar visualisation.
   * @param {Object} audioManager - The audio manager.
   * @param {element} canvas - The canvas upon which to draw.
   * @param {array} instruments - The instruments.
   * @return {Object} self
   */
  return function CircleVisualizer(audioManager, canvas, instruments) {
    var self = {
      render,
      resize,
      init
    };

    var analysers = instruments.map(i => i.a);
    var colors = instruments.map(i => `#${i.c.toString(16)}`);

    var canvasContext = canvas.getContext('2d');

    var xMax = canvas.width;
    var yMax = canvas.height;

    var domains = [];
    var circles = [];
    var targetRadius = [];
    var maxAverageVolume = [];
    var particles = [];

    var baseInstrumentRadius = 80;
    var particleRadius = 10;
    var world;

    function init() {
      world = new p2.World();

      for (let i = 0; i < analysers.length; i++) {
        analysers[i].fftSize = FFT_SIZE;
        analysers[i].smoothingTimeConstant = SMOOTHING_TIME_CONSTANT;
        domains[i] = new Uint8Array(analysers[i].frequencyBinCount);

        var circleBody = new p2.Body({
          position: [0, 0],
          mass: 0
        });

        circleBody.circleShape = new p2.Circle(baseInstrumentRadius);
        circleBody.addShape(circleBody.circleShape);

        circles.push(circleBody);
      }

      resize();

      for (let i = 0; i < circles.length; i++) {
        world.addBody(circles[i]);
      }

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        let randomX = Math.random() * xMax;
        let randomY = Math.random() * yMax;

        var particleBody = new p2.Body({
          position: [randomX, randomY],
          mass: 1
        });

        particleBody.circleShape = new p2.Circle(particleRadius);
        particleBody.addShape(particleBody.circleShape);

        particles.push(particleBody);
        world.addBody(particleBody);
      }
    }

    function positionInstrumentCircles() {
      baseInstrumentRadius = xMax / (circles.length * 4);
      particleRadius = baseInstrumentRadius * PARTICLE_RELATIVE_SIZE;

      for (let i = 0; i < circles.length; i++) {
        circles[i].position[0] = (baseInstrumentRadius * 2) + (i * baseInstrumentRadius * 3.5);
        circles[i].position[1] = 0;
        targetRadius[i] = baseInstrumentRadius;
      }
    }

    /**
     * Draw oscillating wave to canvas
     */
    function drawCircles() {
      canvasContext.fillStyle = 'rgba(255,255,255,1)';
      canvasContext.fillRect(0, 0, xMax, yMax);

      for (let i = 0; i < circles.length; i++) {
        canvasContext.save();

        canvasContext.lineWidth = LINE_WIDTH;
        canvasContext.strokeStyle = colors[i];
        canvasContext.translate(0, yMax / 2);

        canvasContext.beginPath();

        canvasContext.arc(
          circles[i].position[0],
          circles[i].position[1],
          circles[i].circleShape.radius,
          0,
          Math.PI * 2
        );
        canvasContext.stroke();

        canvasContext.restore();
      }

      canvasContext.save();
      canvasContext.translate(0, yMax / 2);
      canvasContext.lineWidth = PARTICLE_STROKE_WIDTH;
      canvasContext.strokeStyle = PARTICLE_STROKE_COLOR;

      for (let i = 0; i < particles.length; i++) {
        canvasContext.beginPath();

        canvasContext.arc(
          particles[i].position[0],
          particles[i].position[1],
          particles[i].circleShape.radius,
          0,
          Math.PI * 2
        );

        canvasContext.stroke();
      }

      canvasContext.restore();
    }

    var frameWait = 1;
    var delay = frameWait;

    /**
     * On render, draw wave
     */
    function render(delta) {
      delay--;

      if (delay > 0) {
        return;
      }

      delay = frameWait;

      getRun();
      tickChase(delta);
      drawCircles();
    }

    /**
     * Chase the target points.
     * @param {number} delta - The animation delta.
     */
    function tickChase(delta) {
      for (let i = 0; i < circles.length; i++) {
        targetRadius[i] = targetRadius[i] || baseInstrumentRadius;
        circles[i].circleShape.radius += (targetRadius[i] - circles[i].circleShape.radius) * 0.05;
      }
    }

    /**
     * On resize, draw wave
     */
    function resize() {
      xMax = canvas.width;
      yMax = canvas.height;

      positionInstrumentCircles();

      getRun();
      tickChase(0);
      drawCircles();
    }

    function getRun() {
      for (let i = 0; i < circles.length; i++) {
        analysers[i].getByteFrequencyData(domains[i]);

        let averageVolume = getHighestVolume(domains[i]);

        if (!maxAverageVolume[i] || (averageVolume > maxAverageVolume[i])) {
          maxAverageVolume[i] = averageVolume;
        }

        let amplitude = (averageVolume / maxAverageVolume[i]);

        if (isNaN(amplitude)) { amplitude = 0; }
        if (amplitude <= 0) { amplitude = 0; }
        if (amplitude >= 1) { amplitude = 1; }

        targetRadius[i] = baseInstrumentRadius + (amplitude * baseInstrumentRadius * 0.75);
      }
    }

    function getHighestVolume(array) {
      var values = 0;

      for (let i = 0; i < array.length; i++) {
        values += array[i];
      }

      return values / array.length;
    }

    return self;
  };
})();
