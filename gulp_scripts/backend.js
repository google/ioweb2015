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

var fs = require('fs');
var spawn = require('child_process').spawn;

var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var browserSync = require('browser-sync');

var IOWA = require('../package.json').iowa;

/** Copy backend files, including GAE and server configs.
 *
 * @param {string} appenv App environment: 'dev', 'stage' or 'prod'.
 * @param {function} callback Callback function.
 */
function copy(appenv, callback) {
  gulp.src([
    IOWA.backendDir + '/**/*.go',
    IOWA.backendDir + '/*.yaml',
    IOWA.backendDir + '/*.config'
  ], {base: './'})
  .pipe(gulp.dest(IOWA.distDir))
  .on('end', function() {
    var destBackend = [IOWA.distDir, IOWA.backendDir].join('/');
    // ../app <= dist/backend/app
    fs.symlinkSync('../' + IOWA.appDir, destBackend + '/' + IOWA.appDir);
    // create server config for the right env
    generateServerConfig(destBackend, appenv);
    // create GAE config from backend/app.yaml.template
    generateGAEConfig(destBackend, callback);
  });
}

/** Run backend tests.
 *
 * @param {Object} opts Test options.
 * @param {bool} opts.gae Run GAE tests.
 * @param {bool} opts.watch Watch for changes and re-run tests.
 * @param {string} opts.test Test method names pattern.
 * @param {function} callback Callback function.
 */
function test(opts, callback) {
  var start = function(cmd) {
    var run = singleTestRound.bind(null, cmd, opts.test);
    var proc = run();
    if (opts.watch) {
      gulp.watch([IOWA.backendDir + '/**/*.go'], run);
      gulp.watch([IOWA.appDir + '/templates/*'], run);
      callback();
      return;
    }
    proc.on('close', callback);
  };

  if (!opts.gae) {
    start('go');
    return;
  }
  gaeSdkDir(function(dir) {
    start(dir + '/goapp');
  });
}

/**
 * Run a single round of tests.
 *
 * @param {string} cmd Command to start the tests; 'go' or 'goapp'.
 * @param {string} testPattern Test method names pattern.
 * @return {ChildProcess} Process object of the spawn cmd.
 */
function singleTestRound(cmd, testPattern) {
  var args = ['test'];
  if (testPattern) {
    args.push('-test.run=' + testPattern);
  }
  return spawn(cmd, args, {cwd: IOWA.backendDir, stdio: 'inherit'});
}

/**
 * Start a standalone server (no GAE SDK needed) serving both front-end and backend.
 *
 * @param {Object} opts Server options.
 * @param {number=} opts.port The port number to bind internal server to.
 * @param {string} opts.dir CWD of the spawning server process.
 * @param {bool} opts.watch Watch for *.go file changes and restart the server.
 * @param {bool} opts.reload Use BrowserSync to reload page on file changes. Implies opts.watch.
 * @param {function} callback Callback function.
 * @return {string} URL of the externally facing server.
 */
function serve(opts, callback) {
  if (opts.reload) {
    // reload doesn't make sense w/o watch
    opts.watch = true;
  }
  var port = opts.port || (opts.reload ? '8080' : '3000');
  var serverAddr = 'localhost:' + port;
  var url = 'http://' + serverAddr + IOWA.urlPrefix;

  var proc;
  var spawnBackend = function() {
    var env = process.env;
    env['RUN_WITH_DEVAPPSERVER'] = '1';
    proc = spawn('bin/server', ['-addr', serverAddr],
                 {cwd: opts.dir, stdio: 'inherit', env: env});
  };

  spawnBackend();

  if (!opts.watch) {
    proc.on('close', callback);
    console.log('The app should now be available at: ' + url);
    return url;
  }

  gulp.watch([IOWA.backendDir + '/**/*.go'], function() {
    build(function(code) {
      if (code !== 0) {
        return;
      }
      console.log('Restarting backend');
      proc.on('close', spawnBackend);
      proc.kill();
    });
  });

  if (!opts.reload) {
    proc.on('close', function(code, signal) {
      if (signal === 'SIGINT') {
        callback(code);
      }
    });
    console.log('The app should now be available at: ' + url);
    return url;
  }

  browserSync.emitter.on('service:exit', function() {
    proc.kill('SIGKILL');
    callback();
  });
  browserSync({notify: false, open: false, port: 3000, proxy: serverAddr});
  return 'http://localhost:3000' + IOWA.urlPrefix;
}

/**
 * Start GAE-based backend server.
 *
 * @param {Object} opts Server options.
 * @param {number=} opts.port The port number to bind internal server to.
 * @param {string} opts.dir CWD of the spawning server process.
 * @param {bool} opts.reload Use BrowserSync to reload page on file changes.
 * @param {function} callback Callback function.
 * @return {string} URL of the externally facing server.
 */
function serveGAE(opts, callback) {
  var port = opts.port || (opts.reload ? '8080' : '3000');
  var serverAddr = 'localhost:' + port;
  var url = 'http://' + serverAddr + IOWA.urlPrefix;
  var args = [
    'preview', 'app', 'run', opts.dir,
    '--host', serverAddr,
    '--datastore-path', IOWA.backendDir + '/.gae_datastore'
  ];

  var backend = spawn('gcloud', args, {stdio: 'inherit'});
  if (!opts.reload) {
    console.log('The app should now be available at: ' + url);
    backend.on('close', callback);
    return url;
  }

  browserSync.emitter.on('service:exit', callback);
  // give GAE server some time to start
  setTimeout(browserSync.bind(null, {notify: false, open: false, port: 3000, proxy: serverAddr}), 2000);
  return 'http://localhost:3000' + IOWA.urlPrefix;
}

/**
 * Create or update server config.
 *
 * @param {string} dest Output directory.
 * @param {string} appenv App environment: 'dev', 'stage' or 'prod'.
 */
function generateServerConfig(dest, appenv) {
  dest = (dest || IOWA.backendDir) + '/server.config';
  appenv = appenv || 'dev';

  var files = [
    IOWA.backendDir + '/server.config',
    IOWA.backendDir + '/server.config.dev',
    IOWA.backendDir + '/server.config.template'
  ];
  var src;
  for (var i = 0, f; f = files[i]; i++) {
    if (fs.existsSync(f)) {
      src = f;
      break;
    }
  }
  if (!src) {
    throw new Error('generateServerConfig: unable to find config template');
  }

  var cfg = JSON.parse(fs.readFileSync(src, 'utf8'));
  cfg.env = appenv;
  cfg.prefix = IOWA.urlPrefix;
  fs.writeFileSync(dest, JSON.stringify(cfg, null, 2));
}

/**
 * Create GAE config files, app.yaml and cron.yaml.
 *
 * @param {string} dest Output directory.
 * @param {function} callback Callback function.
 */
function generateGAEConfig(dest, callback) {
  var files = [
    IOWA.backendDir + '/app.yaml.template',
    IOWA.backendDir + '/cron.yaml.template'
  ];
  gulp.src(files, {base: IOWA.backendDir})
    .pipe($.replace(/\$PREFIX\$/g, IOWA.urlPrefix))
    .pipe($.rename({extname: ''}))
    .pipe(gulp.dest(dest))
    .on('end', callback);
}

/**
 * Build standalone backend server.
 *
 * @param {function} callback Callback function.
 */
function build(callback) {
  var args = ['build', '-o', 'bin/server'];
  var build = spawn('go', args, {cwd: IOWA.backendDir, stdio: 'inherit'});
  build.on('exit', callback);
}

/**
 * Install backend dependencies.
 *
 * @param {function} callback Callback function.
 */
function installDeps(callback) {
  // additional argument is required because it is imported in files
  // hidden by +appengine build tag and not visible to the standard "go get" command.
  var args = ['get', '-d', './' + IOWA.backendDir + '/...', 'google.golang.org/appengine'];
  spawn('go', args, {stdio: 'inherit'}).on('exit', callback);
}

/**
 * Decrypt backend/server.config.enc into backend/server.config.
 *
 * @param {string=} passphrase Passphrase for openssl command.
 * @param {function} callback Callback function.
 */
function decrypt(passphrase, callback) {
  var tarFile = IOWA.backendDir + '/config.tar';
  var args = ['aes-256-cbc', '-d', '-in', tarFile + '.enc', '-out', tarFile];
  if (passphrase) {
    args.push('-pass', 'pass:' + passphrase);
  }
  spawn('openssl', args, {stdio: 'inherit'}).on('exit', function(code) {
    if (code !== 0) {
      callback(code);
      return;
    }
    spawn('tar', ['-x', '-f', tarFile, '-C', IOWA.backendDir], {stdio: 'inherit'}).
    on('exit', fs.unlink.bind(fs, tarFile, callback));
  });
}

/**
 * Encrypt backend/server.config into backend/server.config.enc.
 *
 * @param {string=} passphrase Passphrase for openssl command.
 * @param {function} callback Callback function.
 */
function encrypt(passphrase, callback) {
  var tarFile = IOWA.backendDir + '/config.tar';
  var tarArgs = ['-c', '-f', tarFile, '-C', IOWA.backendDir,
    'server.config.dev',
    'server.config.stage',
    'server.config.prod'
  ];

  spawn('tar', tarArgs, {stdio: 'inherit'}).on('exit', function(code) {
    if (code !== 0) {
      callback(code);
      return;
    }
    var args = ['aes-256-cbc', '-in', tarFile, '-out', tarFile + '.enc'];
    if (passphrase) {
      args.push('-pass', 'pass:' + passphrase);
    }
    spawn('openssl', args, {stdio: 'inherit'}).
    on('exit', fs.unlink.bind(fs, tarFile, callback));
  });
}


/**
 * Find GAE SDK root dir and return the path in the callback.
 *
 * @param {function} callback Callback function.
 */
function gaeSdkDir(callback) {
  var out = '';
  var proc = spawn('gcloud', ['info', '--format' ,'json'], {
    timeout: 3,
    stdio: [process.stdin, 'pipe', process.stderr]
  });

  proc.stdout.on('data', function(chunk) {
    out += chunk;
  });

  proc.stdout.on('end', function() {
    var info = JSON.parse(out);
    callback(info.config.paths.sdk_root + '/platform/google_appengine');
  });
}

module.exports = {
  test: test,
  build: build,
  copy: copy,
  serve: serve,
  serveGAE: serveGAE,
  decrypt: decrypt,
  encrypt: encrypt,
  installDeps: installDeps,
  generateServerConfig: generateServerConfig,
  generateGAEConfig: generateGAEConfig
}
