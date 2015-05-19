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

var glob = require('glob');
var swPrecache = require('sw-precache');
var util = require('gulp-util');

module.exports = function(rootDir, handleFetch, importScripts, callback) {
  var regex = /([^\/]+)\.html$/;
  var templateDir = rootDir + '/templates/';
  var dynamicUrlToDependencies = {
    './': [templateDir + 'layout_full.html', templateDir + 'home.html'],
    './?partial': [templateDir + 'layout_partial.html', templateDir + 'home.html']
  };

  // This isn't pretty, but it works for our dynamic URL mapping.
  glob.sync(templateDir + '!(layout_*).html').forEach(function(template) {
    var matches = template.match(regex);
    if (matches) {
      var path = matches[1];
      var partialPath = path + '?partial';
      dynamicUrlToDependencies[path] = [templateDir + 'layout_full.html', template];
      dynamicUrlToDependencies[partialPath] = [templateDir + 'layout_partial.html', template];
    }
  });

  var config = {
    cacheId: 'iowebapp',
    dynamicUrlToDependencies: dynamicUrlToDependencies,
    handleFetch: handleFetch,
    importScripts: importScripts,
    logger: util.log,
    staticFileGlobs: [
      rootDir + '/bower_components/**/*.{html,js,css}',
      rootDir + '/elements/**',
      rootDir + '/fonts/**',
      rootDir + '/images/**',
      rootDir + '/scripts/**',
      rootDir + '/styles/**/*.css',
      rootDir + '/manifest.json',
      rootDir + '/humans.txt',
      rootDir + '/favicon.ico',
      rootDir + '/data-worker-scripts.js'
    ],
    stripPrefix: rootDir + '/'
  };

  swPrecache(config, callback);
};
