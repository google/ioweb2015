var Promise = require('es6-promise').Promise;

module.exports = (function() {
  'use strict';

  var bufferList = {};

  /**
   * Load a single url.
   * @param {AudioContext} audioContext - Audio context to load buffer into.
   * @param {string} url - The url.
   */
  function loadBuffer(audioContext, url) {
    return new Promise(function(resolve, reject) {
      if (bufferList[url]) {
        resolve(bufferList[url]);
        return;
      }

      // Load buffer asynchronously
      var request = new XMLHttpRequest();
      request.open('GET', url, true);
      request.responseType = 'arraybuffer';

      request.onload = function() {
        // Asynchronously decode the audio file data in request.response
        audioContext.decodeAudioData(
          request.response,
          function(buffer) {
            if (!buffer) {
              console.warn('error decoding file data: ' + url);
              return;
            }
            bufferList[url] = buffer;
            resolve(buffer);
          },
          function(error) {
            reject('decodeAudioData error', error);
          }
        );
      };

      request.onerror = function() {
        reject('BufferLoader: XHR error');
      };

      request.send();
    });
  }

  return {
    loadBuffer: loadBuffer
  };
})();
