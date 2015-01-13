var animate = require('app/util/animate');

module.exports = (function() {
  'use strict';

  const LINE_COLOR = '#BDBDBD';
  const LINE_WIDTH = 1;
  const MIN_DECIBELS = -150;
  const MAX_DECIBELS = 0;
  const FFT_SIZE = 64;
  const SMOOTHING_TIME_CONSTANT = 0.9;

  /**
   * Create analyser node for circle visualisation.
   * @param {Object} audioManager - The audio manager.
   * @param {element} canvas - The canvas upon which to draw.
   * @return {Object} self
   */
  return function CircleVisualizer(audioManager, canvas) {
    var self = {
      render,
      resize,
      enable,
      init,
      disable
    };

    var maximumWidth  = 0;
    var minimumSize = 5;
    var maximumSize = 20;

    var scale  = 0;
    var iconSizes = [];
    var iconSizesTween = [];
    var lasticonSizesTween = [];
    var lastYPosTweenObject = [];

    var range = 3;
    var rangeOffsetLeft = 10;
    var rangeOffsetRight = 10;

    var currentId = 1;
    var intervalID;
    var intervalID2;

    var analyser = audioManager.analyser;
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = SMOOTHING_TIME_CONSTANT;

    var canvasContext = canvas.getContext('2d');
    var freqDomain = new Uint8Array(analyser.frequencyBinCount);

    analyser.minDecibels = MIN_DECIBELS;
    analyser.maxDecibels = MAX_DECIBELS;

    var length = 25;

    var yTween = [];
    var lastYTween = [];

    var amplitude;

    function init() {
      rebuild();
      intervalID = window.setInterval(incId, 300);
      intervalID2 = window.setInterval(ypop, 400);
    }

    function ypop() {
      for (let m = 0; m < iconSizes.length; m++) {
        tweenByIdYpos(m);
      }
    }

    function rebuild() {
      iconSizes = [];
      for (let i = 0; i < length; i++) {
        iconSizes[i] = minimumSize;
      }
    }

    function incId() {
      if (currentId < length) {
        currentId = currentId+1;
        resizeCircles();
      } else {
        currentId = 0;
        resizeCircles();
      }
    }

    /**
     * Draw circles to canvas based on audio frequency.
     */
    function drawCircles() {
      var canvasWidth = canvas.width;
      var canvasHeight = canvas.height;

      circleScale();

      canvasContext.clearRect(0, 0, canvasWidth, canvasHeight);
      canvasContext.fillStyle = 'white';
      canvasContext.fillRect(0, 0, canvasWidth, canvasHeight);

      analyser.getByteFrequencyData(freqDomain);

      var lastWidth = 0;
      var myx = 0;
      for (let i = 0; i < iconSizes.length; i++) {
        let radius = iconSizesTween[i];
        canvasContext.beginPath();
        amplitude = freqDomain[i];

        let offset = canvasHeight/2 + yTween[i];
        myx = myx + (iconSizesTween[i]) + lastWidth;
        canvasContext.arc(myx, offset, radius, 0, 2 * Math.PI, false);
        canvasContext.fillStyle = '#ffffff';

        if (i === iconSizes.length) {
          canvasContext.fillStyle = '#cccccc';
        }

        canvasContext.fill();
        canvasContext.lineWidth = LINE_WIDTH;
        canvasContext.strokeStyle = LINE_COLOR;
        canvasContext.stroke();
        lastWidth = iconSizesTween[i];
      }
    }

    function circleScale() {
      if (scale < 1) {
        scale = 1;
      } else if (scale >= 1){
        scale = 1;
      }
    }

    function resizeCircles() {
      var index = 0;

      for (let j = 0; j < iconSizes.length; j++) {
        if (j === currentId) {
          index = j;

          // obtain the fraction across the icon that the mouseover event occurred
          let tempX = 0.2;
          let across = (tempX) / iconSizes[index];

          // check a distance across the icon was found (in some cases it will not be)
          if (across) {
            // initialise the current width to 0
            let currentWidth = 0;

            // loop over the icons
            for (let i = 0; i < iconSizes.length; i++) {

              // check whether the icon is in the range to be resized
              if (i < index - range || i > index + range) {
                // set the icon size to the minimum size
                iconSizes[i] = minimumSize + Math.random() * 25;
              } else if (i === index) {
                // set the icon size to be the maximum size
                iconSizes[i] = maximumSize + Math.random() * 25;
              } else if (i < index){
                // set the icon size to the appropriate value
                iconSizes[i] =  minimumSize + Math.round( (maximumSize - minimumSize - 1) * ( Math.cos( (i - index - across + 1) / range * Math.PI) + 1) / 2) + Math.random() * 10;
                // add the icon size to the current width
                currentWidth += iconSizes[i];
              } else {
                // set the icon size to the appropriate value
                iconSizes[i] =  minimumSize + Math.round((maximumSize - minimumSize - 1) * ( Math.cos( (i - index - across) / range * Math.PI) + 1) / 2) + Math.random() * 10;
                // add the icon size to the current width
                currentWidth += iconSizes[i];
              }
            }

            // update the maximum width if necessary
            if (currentWidth > maximumWidth) {
              maximumWidth = currentWidth;
            }

            // detect if the total size should be corrected
            if (index >= range   && index < iconSizes.length - range && currentWidth < maximumWidth){
              // correct the size of the smallest magnified icons
              iconSizes[index - range] += Math.floor((maximumWidth - currentWidth) / 2);
              iconSizes[index + range] += Math.ceil((maximumWidth - currentWidth) / 2);
            }

            // update the sizes of the images
            for (let m = 0; m < iconSizes.length; m++) {
              tweenById(m);
            }
          }
        }
      }
    }

    function tweenById(id) {
      var object = {};

      if (lasticonSizesTween[id]) {
        object.radius = lasticonSizesTween[id];
      } else {
        object.radius = 50;
      }

      animate.to(object, 0.3, { radius:iconSizes[id], onUpdate:tweenByIdUpdate, onUpdateParams: [object, id]});
    }

    function tweenByIdUpdate(object, id) {
      iconSizesTween[id] = object.radius;
      lasticonSizesTween[id]  = object.radius;
    }

    function tweenByIdYpos(id) {
      if (freqDomain[id]) {
        yTween[id] = freqDomain[id] / 2;
      } else {
        yTween[id] = freqDomain[freqDomain.length - 1] / 2;
      }

      if (!lastYPosTweenObject[id]) {
        lastYPosTweenObject[id] = [
          { y: 0 },
          { y: 0, onUpdate: tweenByIdUpdateYpos, onUpdateParams: [id] }
        ];
      }

      if (lasticonSizesTween[id]) {
        lastYPosTweenObject[id][0].y = lastYTween[id];
        lastYTween[id] = yTween[id];
      } else {
        lastYPosTweenObject[id][0].y = 0;
      }

      lastYPosTweenObject[id][1].y = yTween[id];
      animate.to(lastYPosTweenObject[id][0], 0.2, lastYPosTweenObject[id][1]);
    }

    function tweenByIdUpdateYpos(id) {
      yTween[id] = lastYPosTweenObject[id][0].y;
    }

    /**
     * On render, draw circles
     */
    function render() {
      drawCircles();
    }

    /**
     * On resize, draw circles
     * @param {number} w - Width.
     */
    function resize(w) {
      length = Math.round(w / (10 * 2.4));

      if (length < 30) {
        rangeOffsetLeft = 4;
        rangeOffsetRight = 8;
        minimumSize = 4;
        maximumSize = 40;
      } else {
        rangeOffsetLeft = 10;
        rangeOffsetRight = 20;
        minimumSize = 6;
        maximumSize = 60;
      }

      rebuild();
      drawCircles();
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
