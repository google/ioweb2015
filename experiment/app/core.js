var RootView = require('app/views/Root');
var AudioManager = require('app/audio/AudioManager');
var StateManager = require('app/util/StateManager');
var style = require('app/styles/experiment.css');
var audioSpriteDefault = require('app/data/normalaudiosprite.json');
var audioSpriteCat = require('app/data/cataudiosprite.json');
var audioLoopsDefault = require('app/data/loops.json');
var audioLoopsCat = require('app/data/catloops.json');
var {Promise} = require('es6-promise');
var rAFTimeout = require('app/util/rAFTimeout');
var events = require('app/util/events');
var assetPath = require('app/util/assetPath');

/**
 * Main entry point into the experiment.
 * @constructor
 */
module.exports = function Experiment() {
  'use strict';

  var audioManager;
  var rootView;
  var stateManager;

  var eventualDidEnterRecordingMode;
  var eventualDidExitRecordingMode;

  var d = new Date();
  var isAprilFools = (d.getMonth() === 3) && (d.getDate() === 1);
  var isCatMode = isAprilFools || window.location.href.match(/meow/);

  var self = {
    load,
    start,
    serialize,
    tearDown,
    pause,
    play,
    didEnterRecordingMode,
    didExitRecordingMode,
    reloadData,
    consoleDance
  };

  /**
   * Load the experiment data and audio files.
   * @param {Object} audioSprite - The sprited audio file.
   * @param {array} audioLoops - The array of audio loops.
   */
  function load(audioSprite = audioSpriteDefault, audioLoops = audioLoopsDefault) {
    // Prepare experiment-specific styles.
    style.use();

    if (isCatMode) {
      audioSprite = audioSpriteCat;
      audioLoops = audioLoopsCat;
    }

    // Create the AudioManager, which controls all sound in the experiment.
    audioManager = new AudioManager();

    // Define the mapping of sound names to their location in the audio sprite.
    audioManager.defineSounds(audioSprite.spritemap, audioManager);

    // Define looping sounds, which are made up of sounds defined above.
    audioManager.defineSoundLoops(audioLoops, audioManager);

    // Load the audio sprite.
    audioManager.load(audioSprite.resources[0]).then(function() {
      // If the `window.experiment` variable exists, wait for it to initialize us.
      // Otherwise, auto-start.
      if (window.experiment && ('function' === typeof window.experiment.didFinishLoading)) {
        window.experiment.didFinishLoading(self);
      } else {
        start();
      }
    });
  }

  /**
   * Start animating and playing sound.
   * @param {string} instrumentSelector - The means of gathering large instrument boxes on the base page.
   * @param {string} visualizerSelector - The means of gathering smaller visualizer cards on the base page.
   * @param {array<number>} fromPos - The origin point of the transition in (FAB).
   */
  function start(instrumentSelector = '.row', visualizerSelector = '.box', fromPos = [0,0]) {
    events.init();
    audioManager.init();

    stateManager = new StateManager(audioManager);

    // Create the RootView, which controls all visuals in the experiment.
    rootView = new RootView(audioManager, stateManager);

    if (eventualDidEnterRecordingMode) {
      rootView.didEnterRecordingMode(eventualDidEnterRecordingMode);
    }

    if (eventualDidExitRecordingMode) {
      rootView.didExitRecordingMode(eventualDidExitRecordingMode);
    }

    // Start sound engine.
    audioManager.fadeIn(2.25, 0.75);

    // Find base elements and layout views.
    rootView.init(instrumentSelector, visualizerSelector);

    // Load either serialized state or default state.
    stateManager.init();
    stateManager.loadSerializedOrDefault();

    // Start requestAnimationFrame
    rootView.start();

    return new Promise(function(resolve, reject) {
      // Animate transition in.
      rAFTimeout(function() {
        rootView.animateIn(fromPos).then(resolve, reject);

        if (('undefined !== typeof console') && ('function !== typeof console.log')) {
          console.log('Need a dance partner? Run `experiment.consoleDance()`');
        }
      }, 50);
    });
  }

  const SHORTENER_API_URL = 'https://www.googleapis.com/urlshortener/v1/url';
  const SHORTENER_API_KEY = 'AIzaSyBRMm_PwR1cfjT_yLxBiV9PDrwZPRIRLxg';

  /**
   * Serialize the entire experiment to URL encoded data.
   * @param {string=} extraParam - Additional URL params.
   * @return {Promise}
   */
  function serialize(extraParams) {
    extraParams = extraParams || '';

    var fullURL = window.location.origin + window.location.pathname + '?experiment&composition=' + stateManager.toURL() + '&' + extraParams;
    return shortenURL(fullURL);
  }

  /**
   * Use Google's URL shortener to compress an URL for social.
   * @param {string} fullURL - The full url.
   * @return {Promise}
   */
  function shortenURL(fullURL) {
    var endpoint = `${SHORTENER_API_URL}?key=${SHORTENER_API_KEY}`;

    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();

      xhr.open('POST', endpoint, true);
      xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');

      var jsonStr = JSON.stringify({
        longUrl: fullURL
      });

      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4 && xhr.status === 200) {
          try {
            var data = JSON.parse(this.responseText);
            resolve(data.id);
          } catch(e) {
            reject('Parsing URL Shortener result failed.');
          }
        } else if (xhr.status !== 200) {
          reject('Requesting URL Shortener result failed.');
        }
      };

      xhr.send(jsonStr);
    });
  }

  /**
   * Shut down the experiment.
   * @param {array<number>} fromPos - The origin point of the transition in (FAB).
   * @return {Promise}
   */
  function tearDown(fromPos = [0,0]) {
    // Stop sound engine.
    audioManager.fadeOut(0.5).then(function() {
      audioManager.tearDown();
    });

    // Animate transition out.
    return rootView.animateOut(fromPos).then(function() {
      // Remove DOM nodes.
      rootView.cleanUp();
    });
  }

  /**
   * Pause the experiment audio.
   */
  function pause() {
    audioManager.fadeOut(0.75);
  }

  /**
   * Play the experiment audio.
   */
  function play() {
    audioManager.fadeIn(0.75);
  }

  /**
   * If entering record mode.
   * @param {function} cb - The enter callback
   */
  function didEnterRecordingMode(cb) {
    eventualDidEnterRecordingMode = cb;
  }

  /**
   * If exiting record mode.
   * @param {function} cb - The exit callback
   */
  function didExitRecordingMode(cb) {
    eventualDidExitRecordingMode = cb;
  }

  /**
   * Reload the global state.
   */
  function reloadData() {
    rootView.reloadData();
  }

  var isDanceRunning = false;
  /**
   * Start a dance party.
   */
  function consoleDance() {
    if (isDanceRunning) { return; }
    isDanceRunning = true;

    var ROW_PIXELS = 10;
    var COL_PIXELS = 5;

    var video = document.createElement('video');
    video.style.visibility = 'hidden';
    document.body.appendChild(video);
    video.setAttribute('autoplay', 'true');
    video.setAttribute('loop', 'true');
    video.addEventListener('loadeddata', onVideoLoaded, false);
    video.src = assetPath('left-shark.mp4');

    function onVideoLoaded() {
      var width = video.clientWidth;
      var height = video.clientHeight;

      var backCanvas = document.createElement('canvas');
      backCanvas.width = width;
      backCanvas.height = height;
      var backContext = backCanvas.getContext('2d');

      setTimeout(draw, 20, video, width, height, backContext);
    }


    var DARK_TO_LIGHT = "@*!y;,-':` ".split('');
    var NORMALISER = DARK_TO_LIGHT.length / 256;

    function getChar(luminance) {
      var index = Math.floor(luminance * NORMALISER);
      return DARK_TO_LIGHT[index];
    }

    function drawToCanvas(sourceImageData) {
      var sourcePixels = sourceImageData.data;
      var numCols = sourceImageData.width;
      var numRows = sourceImageData.height;

      var rowStr = "\n\n\n\n\n\n\n ";

      for (var row = 0; row < numRows; row += ROW_PIXELS) {
        var rowOffset = row * numCols * 4;
        for (var col = 0; col < numCols; col += COL_PIXELS) {
          var offset = rowOffset + 4 * col;
          var r = sourcePixels[offset];
          var g = sourcePixels[offset + 1];
          var b = sourcePixels[offset + 2];
          var luminance = Math.ceil(0.299 * r + 0.587 * g + 0.114 * b);

          var c = getChar(luminance);

          if ((r === 255) && (g === 255) && (b === 255)) {
            c = ' ';
          }

          rowStr += c;
        }

        rowStr += "\n ";
      }

        console.log('%c' + rowStr, 'font-family: monospace; line-height: 0px; font-size: 10px;');
    }

    function draw(video, width, height, backContext) {
      backContext.drawImage(video, 0, 0, width, height);
      drawToCanvas(backContext.getImageData(0, 0, width, height));
      setTimeout(draw, 40, video, width, height, backContext);
    }
  }

  return self;
};
