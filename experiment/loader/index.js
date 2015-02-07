window.experiment = (function() {
  'use strict';

  var assetPath = require('app/util/assetPath');
  var animatedImg = require('url?limit=10000!loader/images/experiment-fab-animation.gif');
  var exitExpImg = require('url?limit=10000!loader/images/exit-experiment.png');
  var pauseExpImg = require('url?limit=10000!loader/images/pause-experiment.png');
  var playExpImg = require('url?limit=10000!loader/images/play-experiment.png');
  var resetExpImg = require('url?limit=10000!loader/images/reset-experiment.png');
  var shareExpImg = require('url?limit=10000!loader/images/share-experiment.png');
  var loadingExpImg = require('url?limit=10000!loader/images/loading-circle.png');
  var headphonesImg = require('url?limit=200000!loader/images/headphones-on.jpg');
  var unsupportedImg = require('url?limit=200000!loader/images/headphones-error.jpg');
  var {Promise} = require('es6-promise');

  var appSingleton;

  function canLoad() {
    return hasWebGL() &&
           hasWebAudio() &&
           hasWebWorkers();
  }

  function hasWebGL() {
    var claimsSupport = false;
    var canvas = document.createElement('canvas');

    if ('probablySupportsContext' in canvas) {
      claimsSupport = canvas.probablySupportsContext('webgl') || canvas.probablySupportsContext('experimental-webgl');
    } else if ('supportsContext' in canvas) {
      claimsSupport = canvas.supportsContext('webgl') || canvas.supportsContext('experimental-webgl');
    } else {
      claimsSupport = !!window.WebGLRenderingContext;
    }

    // Safari 7 says WebGL is enabled, even when it isn't.
    var isSafari7 = window.navigator.userAgent.match(/Safari/) &&
                    window.navigator.userAgent.match(/Version\/7/);

    return claimsSupport && !isSafari7;
  }

  function hasWebAudio() {
    return !!(window.webkitAudioContext || window.AudioContext);
  }

  function hasWebWorkers() {
    return !!window.Worker;
  }

  var loadTimeout, resolver, rejector;

  function load(timeoutDuration) {
    var loadPromise = new Promise(function(resolve, reject) {
      resolver = resolve;
      rejector = reject;
    });

    if (appSingleton) {
      resolver(appSingleton);
    } else {
      loadTimeout = setTimeout(function() {
        if (rejector) {
          rejector();
        }
      }, timeoutDuration);

      var scr = document.createElement('script');
      scr.setAttribute('async', 'true');
      scr.type = 'text/javascript';
      scr.src = assetPath('/js/experiment.js');
      ((document.getElementsByTagName('head') || [null])[0] || document.getElementsByTagName('script')[0].parentNode).appendChild(scr);
    }

    return loadPromise;
  }

  function didFinishLoading(app) {
    if (loadTimeout) {
      clearTimeout(loadTimeout);
    }

    appSingleton = app;
    if (resolver) {
      resolver(app);
    }
  }

  function serialize() {
    return appSingleton && appSingleton.serialize();
  }

  function tearDown() {
    return appSingleton && appSingleton.tearDown();
  }

  function pause() {
    return appSingleton && appSingleton.pause();
  }

  function play() {
    return appSingleton && appSingleton.play();
  }

  function didExitRecordingMode(cb) {
    return appSingleton && appSingleton.didExitRecordingMode(cb);
  }

  function didEnterRecordingMode(cb) {
    return appSingleton && appSingleton.didEnterRecordingMode(cb);
  }

  return {
    assets: {
      animatedImg,
      exitExpImg,
      pauseExpImg,
      playExpImg,
      resetExpImg,
      shareExpImg,
      loadingExpImg,
      headphonesImg,
      unsupportedImg
    },
    load,
    canLoad,
    didFinishLoading,
    didEnterRecordingMode,
    didExitRecordingMode,
    tearDown,
    serialize,
    pause,
    play
  };
})();
