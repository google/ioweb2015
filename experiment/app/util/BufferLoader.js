/**
 * Copyright 2015 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var {Promise} = require('es6-promise');

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
