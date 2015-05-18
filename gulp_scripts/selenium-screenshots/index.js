/* jshint node: true */

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

'use strict';

var BlinkDiff = require('blink-diff');
var Promise = require('es6-promise').Promise;
var URL = require('dom-urls');
var del = require('del');
var exec = require('child_process').exec;
var fs = require('fs');
var glob = require('glob');
var path = require('path');
var spawn = require('child_process').spawn;
var sprintf = require("sprintf-js").sprintf;
var util = require('gulp-util');
var webdriver = require('selenium-webdriver');

var SCREENSHOTS_DIR = 'screenshots';

function seleniumInstall() {
  return new Promise(function(resolve, reject) {
    var seleniumPath = path.join('node_modules', 'selenium-standalone', '.selenium', 'chromedriver');
    fs.exists(seleniumPath, function(exists) {
      if (exists) {
        util.log(seleniumPath, 'already exists.');
        resolve();
      } else {
        require('selenium-standalone').install({
          logger: util.log
        }, reject('The selenium-standalone driver was just installed. ' +
                  'Please re-run this command so that it\'s picked up in your path.'));
      }
    });
  });
}

function git(args) {
  var commandLine = 'git ' + args.join(' ');
  util.log('Running', commandLine);
  return new Promise(function(resolve, reject) {
    var gitCommand = exec(commandLine, function(error, output) {
      if (error) {
        util.log(error);
        // git exits with an error status when, e.g., there's nothing to restore with git stash pop
        // Let's log, but not reject() here.
        resolve();
      } else {
        resolve(output.trim());
      }
    });
  });
}

function startServer(hostPort) {
  return new Promise(function(resolve, reject) {
    // TODO(jeffposnick): These directories shouldn't be hardcoded.
    // Ideally, there will be a refactored set of server tasks and I could just call those directly.
    var server = spawn(
      'bin/server',
      ['-addr', hostPort],
      {cwd: 'backend', stdio: 'ignore'}
    ).on('error', reject);

    resolve(server);
  });
}

function stopServer(server) {
  return new Promise(function(resolve, reject) {
    util.log('Stopping server...');
    server
      .on('exit', resolve)
      .on('error', reject);
    server.kill();
  });
}

function takeScreenshots(driver, branch, baseUrl, pages, widths, height) {
  util.log('Queueing screenshots for pages', pages);
  // WebDriver has its own Promises, so let's wrap that in a standard ES6 Promise.
  return new Promise(function(resolve, reject) {
    var directory = path.join(SCREENSHOTS_DIR, branch);
    fs.mkdirSync(directory);
    var takeScreenshotPromises = pages.map(function(page) {
      return takeScreenshot(driver, baseUrl + page, page, widths, height, directory);
    });

    webdriver.promise.all(takeScreenshotPromises).then(resolve, reject);
  });
}

function takeScreenshot(driver, url, page, widths, height, directory) {
  return driver.get(url).then(function() {
    return driver.manage().timeouts().setScriptTimeout(15000);
  }).then(function() {
    var script = 'document.addEventListener("page-transition-done", arguments[arguments.length - 1]);';
    return driver.executeAsyncScript(script).then(null, function() {
      util.log('Timeout out while waiting for page event to fire, so just taking a screenshot...');
    });
  }).then(function() {
    var saveScreenshotPromises = widths.map(function(width) {
      util.log(sprintf('Taking screenshot of %s @ %dx%d...', url, width, height));
      return driver.manage().window().setSize(width, height).then(function() {
        return driver.sleep(750);
      }).then(function() {
        return driver.takeScreenshot();
      }).then(function(data) {
        var screenshotPath = sprintf('%s/%s-%dx%d.png', directory, page, width, height);
        var base64Data = data.replace(/^data:image\/png;base64,/, '');

        return saveScreenshot(screenshotPath, base64Data);
      });
    });

    return webdriver.promise.all(saveScreenshotPromises);
  });
}

function saveScreenshot(screenshotPath, base64Data) {
  var defered = webdriver.promise.defer();

  fs.writeFile(screenshotPath, base64Data, 'base64', function(error) {
    if (error) {
      util.log('Unable to save screenshot:', error);
      defered.reject(error);
    } else {
      util.log('Saved screenshot to', screenshotPath);
      defered.fulfill();
    }
  });

  return defered.promise;
}

function compareScreenshots() {
  var diffsDirectory = path.join(SCREENSHOTS_DIR, 'diffs');
  fs.mkdirSync(diffsDirectory);

  var filePaths = glob.sync(SCREENSHOTS_DIR + '/**/*.png');
  var fileNameToPaths = {};
  filePaths.forEach(function(filePath) {
    var fileName = path.basename(filePath);
    if (fileName in fileNameToPaths) {
      fileNameToPaths[fileName].push(filePath);
    } else {
      fileNameToPaths[fileName] = [filePath];
    }
  });

  var diffPromises = Object.keys(fileNameToPaths).map(function(fileName) {
    return new Promise(function(resolve, reject) {
      var paths = fileNameToPaths[fileName];
      if (paths.length == 2) {
        var diff = new BlinkDiff({
          imageAPath: paths[0],
          imageBPath: paths[1],
          imageOutputPath: path.join(diffsDirectory, path.basename(paths[0])),
          imageOutputLimit: BlinkDiff.OUTPUT_DIFFERENT
        });
        diff.run(function(error) {
          if (error) {
            util.log('Error while comparing', fileName, error);
            reject(error);
          } else {
            util.log('Completed comparison of', fileName);
            resolve();
          }
        });
      }
    });
  });

  return Promise.all(diffPromises).then(function() {
    var diffFiles = glob.sync(diffsDirectory + '/*.png');
    if (diffFiles.length) {
      util.log('Differences were found in:', diffFiles);
    } else {
      util.log('No differences were found.');
    }
  });
}

module.exports = function(branchOrCommit, serverRoot, url, pages, widths, height, callback) {
  del.sync(SCREENSHOTS_DIR);
  fs.mkdirSync(SCREENSHOTS_DIR);

  var chromeWebDriver = require('selenium-webdriver/chrome');
  var chromeDriverBinary = glob.sync('node_modules/selenium-standalone/.selenium/chromedriver/*chromedriver*')[0];
  var driver;

  var parsedUrl = new URL(url);
  // Return a no-op promise that will be run if an exception is thrown before the server
  // needs to be stopped or before the git state needs to be restored.
  var restorePromise = function() { return Promise.resolve() };
  var stopServerPromise = function() { return Promise.resolve() };
  var cleanup = function(error) {
    return stopServerPromise()
      .then(restorePromise)
      .then(
        function() {
          if (driver) {
            driver.quit();
          }
          callback(error);
        },
        callback.bind(null, error)
      );
  };

  seleniumInstall()
    .then(function() {
      var driverService = new chromeWebDriver.ServiceBuilder(chromeDriverBinary).build();
      driver = new chromeWebDriver.Driver(null, driverService);
      return git(['rev-parse', '--abbrev-ref', 'HEAD']);
    })
    .then(function(currentBranch) {
      // Set up a function which returns a promise which restores the current state.
      restorePromise = function() {
        return git(['checkout', currentBranch])
          .then(git.bind(null, ['stash', 'pop']));
      };
    })
    .then(git.bind(null, ['stash']))
    .then(git.bind(null, ['checkout', branchOrCommit]))
    .then(startServer.bind(null, parsedUrl.host))
    .then(function(server) {
      // Set up a function which returns a promise that stops the active server.
      stopServerPromise = stopServer.bind(null, server);
    })
    .then(function() {
      return takeScreenshots(driver, branchOrCommit, url, pages, widths, height);
    })
    .then(function() {
      // Restore the git state then set restorePromise back to a function returning a no-op promise,
      // since it is run as part of the cleanup().
      return restorePromise().then(function() {
        restorePromise = function() { return Promise.resolve() };
      });
    })
    .then(function() {
      return takeScreenshots(driver, 'current', url, pages, widths, height);
    })
    .then(compareScreenshots)
    // Run cleanup regardless of whether there was an exception or not.
    .then(cleanup, cleanup);
};
