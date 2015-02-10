/* jshint node: true */

'use strict';

var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;

var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var pagespeed = require('psi');
var del = require('del');
var i18n_replace = require('./gulp_scripts/i18n_replace');
var generateServiceWorker = require('./gulp_scripts/generate_service_worker');
var runSequence = require('run-sequence');
var argv = require('yargs').argv;
var browserSync = require('browser-sync');
var reload = browserSync.reload;
var opn = require('opn');
var merge = require('merge-stream');
var glob = require('glob');
var Promise = require('es6-promise').Promise;

var APP_DIR = 'app';
var BACKEND_DIR = 'backend';
var EXPERIMENT_DIR = 'experiment';
var BACKEND_APP_YAML = BACKEND_DIR + '/app.yaml';

var DIST_STATIC_DIR = 'dist';
var DIST_EXPERIMENT_DIR = APP_DIR + '/experiment';

var STATIC_VERSION = 1; // Cache busting static assets.
var VERSION = argv.build || STATIC_VERSION;
var URL_PREFIX = (argv.urlPrefix || '').replace(/\/+$/g, '') || '/io2015';
var EXPERIMENT_STATIC_URL = URL_PREFIX + '/experiment/';

// Clears files cached by gulp-cache (e.g. anything using $.cache).
gulp.task('clear', function (done) {
  return $.cache.clearAll(done);
});

// TODO(ericbidelman): also remove generated .css files.
gulp.task('clean', ['clear'], function(cleanCallback) {
  del([DIST_STATIC_DIR, DIST_EXPERIMENT_DIR], cleanCallback);
});

gulp.task('sass', function() {
  return gulp.src([APP_DIR + '/{styles,elements}/**/*.scss'])
    .pipe($.sass({outputStyle: 'compressed'}))
    .pipe($.changed(APP_DIR + '/{styles,elements}', {extension: '.scss'}))
    .pipe($.autoprefixer([
      'ie >= 10',
      'ie_mob >= 10',
      'ff >= 33',
      'chrome >= 38',
      'safari >= 7',
      'opera >= 26',
      'ios >= 7'
    ]))
    .pipe(gulp.dest(APP_DIR))
    .pipe($.size({title: 'styles'}));
});

// vulcanize main site elements separately.
gulp.task('vulcanize-elements', ['sass'], function() {
  return gulp.src([
      APP_DIR + '/elements/elements.html'
    ])
    .pipe($.vulcanize({
      strip: !argv.pretty,
      csp: true,
      inline: true,
      dest: APP_DIR + '/elements'
    }))
    // .pipe(i18n_replace({
    //   strict: !!argv.strict,
    //   path: '_messages',
    // }))
    .pipe(gulp.dest(DIST_STATIC_DIR + '/' + APP_DIR + '/elements/'));
});

// vulcanize extended form elements separately.
gulp.task('vulcanize-extended-elements', ['sass'], function() {
  return gulp.src([
      APP_DIR + '/elements/io-extended-form.html'
    ])
    .pipe($.vulcanize({
      strip: !argv.pretty,
      csp: true,
      inline: true,
      dest: APP_DIR + '/elements',
      excludes: {
        imports: [ // These are registered in the main site vulcanized bundle.
          'polymer.html$',
          'core-icon.html$',
          'core-iconset-svg.html$',
          'core-shared-lib.html$',
          'paper-button.html$'
        ]
      }
    }))
    .pipe(gulp.dest(DIST_STATIC_DIR + '/' + APP_DIR + '/elements/'));
});

// gulp.task('i18n_index', function() {
//   return gulp.src(['index.html', 'error.html', 'upgrade.html'])
//     .pipe(argv.pretty ? $.gutil.noop() : $.replace(/window\.DEV ?= ?true.*/, ''))
//     .pipe($.replace('<base href="">',
//         '<base href="' + STATIC_URL + '">'))
//     .pipe(i18n_replace({
//       strict: !!argv.strict,
//       path: '_messages',
//     }))
//     .pipe(gulp.dest(DIST_PROD_DIR));
// });

// copy needed assets (images, polymer elements, etc) to /dist directory
gulp.task('copy-assets', function() {
  var assets = $.useref.assets();

  var templateStream = gulp.src([APP_DIR + '/templates/*.html'], {base: './'})
    .pipe(assets)
    .pipe(assets.restore())
    .pipe($.useref());

  var otherAssetStream = gulp.src([
    APP_DIR + '/*.{html,txt,ico}',
    APP_DIR + '/manifest.json',
    APP_DIR + '/clear_cache.html',
    APP_DIR + '/styles/**.css',
    APP_DIR + '/styles/pages/upgrade.css',
    APP_DIR + '/styles/pages/error.css',
    APP_DIR + '/elements/**/images/*',
    APP_DIR + '/elements/webgl-globe/shaders/*.{frag,vert}',
    APP_DIR + '/elements/webgl-globe/textures/*.{jpg,png}',
    APP_DIR + '/bower_components/webcomponentsjs/webcomponents.min.js',
    APP_DIR + '/bower_components/es6-promise-2.0.1.min/index.js',
    DIST_EXPERIMENT_DIR + '/**/*'
  ], {base: './'});

  return merge(templateStream, otherAssetStream)
    .pipe(gulp.dest(DIST_STATIC_DIR))
    .pipe($.size({title: 'copy-assets'}));
});

// Copy backend files.
gulp.task('copy-backend', ['backend:config'], function(cb) {
  gulp.src([
    BACKEND_DIR + '/**/*.go',
    BACKEND_DIR + '/*.yaml',
    BACKEND_DIR + '/*.config',
    BACKEND_DIR + '/*.pem',
    BACKEND_DIR + '/whitelist'
  ], {base: './'})
  // server_gae.go
  .pipe($.replace(/(httpPrefix = ")[^"]*/g, '$1' + URL_PREFIX))
  .pipe(gulp.dest(DIST_STATIC_DIR))
  .on('end', function() {
    var destBackend = [DIST_STATIC_DIR, BACKEND_DIR].join('/');
    // ../app <= dist/backend/app
    fs.symlinkSync('../' + APP_DIR, destBackend + '/' + APP_DIR);
    // create dist/backend/app.yaml from backend/app.yaml.template
    generateAppYaml(destBackend, URL_PREFIX, cb);
  });
});

// Lint JavaScript
gulp.task('jshint', function() {
  return gulp.src([APP_DIR + '/scripts/**/*.js'])
    .pipe(reload({stream: true, once: true}))
    .pipe($.jshint())
    .pipe($.jshint.reporter('jshint-stylish'))
    .pipe($.if(!browserSync.active, $.jshint.reporter('fail')));
});

// Check JS style
gulp.task('jscs', function() {
  return gulp.src([APP_DIR + '/scripts/**/*.js'])
    .pipe(reload({stream: true, once: true}))
    .pipe($.jscs());
});

// Crush JS
gulp.task('concat-and-uglify-js', ['js'], function() {
  // The ordering of the scripts in the gulp.src() array matter!
  // This order needs to match the order in templates/layout_full.html
  var siteScripts = [
    'main.js',
    'helper/util.js',
    'helper/page-animation.js',
    'helper/elements.js',
    'helper/service-worker-registration.js',
    'helper/history.js',
    'helper/router.js',
    'helper/request.js',
    'helper/picasa.js',
    'bootstrap.js'
  ].map(function(script) {
    return APP_DIR + '/scripts/' + script;
  });

  var siteScriptStream = gulp.src(siteScripts)
    .pipe(reload({stream: true, once: true}))
    .pipe($.concat('site-scripts.js'));

  // analytics.js is loaded separately and shouldn't be concatenated.
  var analyticsScriptStream = gulp.src([APP_DIR + '/scripts/analytics.js']);

  var serviceWorkerScriptStream = gulp.src([
    APP_DIR + '/bower_components/shed/shed.js',
    APP_DIR + '/scripts/shed/*.js'
  ])
    .pipe(reload({stream: true, once: true}))
    .pipe($.concat('shed-scripts.js'));

  return merge(siteScriptStream, analyticsScriptStream).add(serviceWorkerScriptStream)
    .pipe($.uglify({preserveComments: 'some'}).on('error', function () {}))
    .pipe(gulp.dest(DIST_STATIC_DIR + '/' + APP_DIR + '/scripts'))
    .pipe($.size({title: 'concat-and-uglify-js'}));
});

// Optimize Images
gulp.task('images', function() {
  return gulp.src([
      APP_DIR + '/images/**/*'
    ])
    .pipe($.cache($.imagemin({
      progressive: true,
      interlaced: true
    })))
    .pipe(gulp.dest(DIST_STATIC_DIR + '/' + APP_DIR + '/images'))
    .pipe($.size({title: 'images'}));
});

// Run PageSpeed Insights
// Update `url` below to the public URL for your site
gulp.task('pagespeed', pagespeed.bind(null, {
  // By default, we use the PageSpeed Insights
  // free (no API key) tier. You can use a Google
  // Developer API key if you have one. See
  // http://goo.gl/RkN0vE for info key: 'YOUR_API_KEY'
  url: 'https://example.com',
  strategy: 'mobile'
}));

// Start a standalone server (no GAE SDK needed) serving both front-end and backend,
// watch for file changes and live-reload when needed.
// If you don't want file watchers and live-reload, use '--no-watch' option.
gulp.task('serve', ['backend', 'backend:config', 'generate-service-worker-dev'], function() {
  var noWatch = argv.watch === false;
  var serverAddr = 'localhost:' + (noWatch ? '3000' : '8080');
  var startArgs = ['-d', APP_DIR, '-listen', serverAddr, '-prefix', URL_PREFIX];
  var start = spawn.bind(null, 'bin/server', startArgs, {cwd: BACKEND_DIR, stdio: 'inherit'});

  if (noWatch) {
    start();
    serverAddr = 'http://' + serverAddr;
    console.log('The site should now be available at: ' + serverAddr);
    opn(serverAddr + URL_PREFIX);
    return;
  }

  var backend;
  var run = function() {
    backend = start();
    backend.on('close', run);
  };
  var restart = function() {
    console.log('Restarting backend');
    backend.kill();
  };

  browserSync.emitter.on('service:exit', function() {
    backend.kill('SIGKILL');
  });

  run();
  browserSync({notify: false, proxy: serverAddr, startPath: URL_PREFIX});

  watch();
  gulp.watch([BACKEND_DIR + '/**/*.go'], function() {
    console.log('Building backend');
    buildBackend(restart);
  });
});

// The same as 'serve' task but using GAE dev appserver.
// If you don't want file watchers and live-reload, use '--no-watch' option.
gulp.task('serve:gae', ['backend:config', 'generate-service-worker-dev'], function(callback) {
  var appEnv = process.env.APP_ENV || 'dev';
  var watchFiles = argv.watch !== false;
  var run = startGaeBackend.bind(null, BACKEND_DIR, appEnv, watchFiles, callback);
  generateAppYaml(BACKEND_DIR, URL_PREFIX, run);
});

// Serve build with GAE dev appserver. This is how it would look in production.
// There are no file watchers.
gulp.task('serve:dist', ['default'], function(callback) {
  var appEnv = process.env.APP_ENV || 'prod';
  var backendDir = DIST_STATIC_DIR + '/' + BACKEND_DIR;
  startGaeBackend(backendDir, appEnv, false, callback);
});

gulp.task('vulcanize', ['vulcanize-elements', 'vulcanize-extended-elements']);

gulp.task('js', ['jshint', 'jscs']);

// Build experiment and place inside app.
gulp.task('build-experiment', buildExperiment);

// Copy experiment files.
gulp.task('copy-experiment-to-site', ['build-experiment'], function(cb) {
  gulp.src([
    EXPERIMENT_DIR + '/public/js/*.*',
    EXPERIMENT_DIR + '/public/*.mp3',
    EXPERIMENT_DIR + '/public/*.mp4'
  ], {base: EXPERIMENT_DIR + '/public/' })
  .pipe(gulp.dest(DIST_EXPERIMENT_DIR))
  .on('end', cb);
});

// Build self-sufficient backend server binary w/o GAE support.
gulp.task('backend', buildBackend);

// Create server config if one doesn't exist. Needed to run the server.
gulp.task('backend:config', generateServerConfig);

// Backend TDD: watch for changes and run tests in an infinite loop.
gulp.task('backend:test', function(cb) {
  var watchOpt = process.argv.indexOf('--watch') >= 0;
  var t = testBackend();
  if (watchOpt) {
    gulp.watch([BACKEND_DIR + '/**/*.go'], testBackend);
    gulp.watch([APP_DIR + '/templates/*'], testBackend);
    cb();
  } else {
    t.on('close', cb);
  }
});

gulp.task('default', ['clean'], function(cb) {
  runSequence('copy-experiment-to-site', 'sass', 'vulcanize',
              ['concat-and-uglify-js', 'images', 'copy-assets', 'copy-backend'],
              'generate-service-worker-dist', cb);
});

gulp.task('bower', function(cb) {
  var proc = spawn('../node_modules/bower/bin/bower', ['install'], {cwd: APP_DIR, stdio: 'inherit'});
  proc.on('close', cb);
});

gulp.task('addgithooks', function() {
  return gulp.src('.git-hooks/*')
    .pipe($.chmod(755))
    .pipe(gulp.dest('.git/hooks'));
});

gulp.task('godeps', function() {
  spawn('go', ['get', '-d', './' + BACKEND_DIR + '/...'], {stdio: 'inherit'});
});

// decrypt service account key and server config.
// use --pass cmd line arg to provide a pass phrase.
gulp.task('decrypt', function(done) {
  var files = [
    BACKEND_DIR + '/service-account.pem',
    BACKEND_DIR + '/server.config'
  ];
  var promises = files.map(function(f) {
    return new Promise(function(resolve, reject) {
      var args = ['aes-256-cbc', '-d', '-pass', 'pass:' + argv.pass, '-in', f + '.enc', '-out', f];
      spawn('openssl', args, {stdio: 'inherit'}).on('close', function(code) {
        if (code === 0) {
          resolve();
        } else {
          reject(code);
        }
      });
    });
  });
  Promise.all(promises).then(done.bind(null, null), function(code) {
    done('Some commands exited with code: ' + code);
  });
});

gulp.task('setup', function(cb) {
  runSequence('bower', 'godeps', 'addgithooks', 'default', cb);
});

// -----------------------------------------------------------------------------

// Watch file changes and reload running server
// or rebuild stuff.
function watch() {
  gulp.watch([APP_DIR + '/**/*.html'], reload);
  gulp.watch([APP_DIR + '/{elements,styles}/**/*.{scss,css}'], ['sass', reload]);
  gulp.watch([APP_DIR + '/scripts/**/*.js'], ['jshint']);
  gulp.watch([APP_DIR + '/images/**/*'], reload);
  gulp.watch([APP_DIR + '/bower.json'], ['bower']);
}

// Build experiment and place inside app.
function buildExperiment(cb) {
  var args = [EXPERIMENT_STATIC_URL];
  var build = spawn('./bin/build', args, {cwd: EXPERIMENT_DIR, stdio: 'inherit'});
  build.on('close', cb);
}

// Build standalone backend server
function buildBackend(cb) {
  var args = ['build', '-o', 'bin/server'];
  var build = spawn('go', args, {cwd: BACKEND_DIR, stdio: 'inherit'});
  build.on('close', cb);
}

// Run backend tests
function testBackend() {
  var args = ['test', '-v'];
  return spawn('go', args, {cwd: BACKEND_DIR, stdio: 'inherit'});
}

// Start GAE-based backend server with backendDir as the app root directory.
// Also, enable live-reload if watchFiles === true.
// appEnv is either 'stage', 'prod' or anything else. The latter defaults to
// dev env.
function startGaeBackend(backendDir, appEnv, watchFiles, callback) {
  var restoreAppYaml = changeAppYamlVersion('v-' + appEnv, backendDir + '/app.yaml');
  var onExit = function() {
    restoreAppYaml();
    callback();
  };

  var serverAddr = 'localhost:' + (watchFiles ? '8080' : '3000');
  var args = ['preview', 'app', 'run', backendDir, '--host', serverAddr];

  var backend = spawn('gcloud', args, {stdio: 'inherit'});
  if (!watchFiles) {
    process.on('exit', onExit);
    serverAddr = 'http://' + serverAddr;
    console.log('The site should now be available at: ' + serverAddr);
    // give GAE server some time to start
    setTimeout(opn.bind(null, serverAddr + URL_PREFIX, null, null), 2000);
    return;
  }

  browserSync.emitter.on('service:exit', onExit);
  // give GAE server some time to start
  setTimeout(browserSync.bind(null, {notify: false, proxy: serverAddr, startPath: URL_PREFIX}), 2000);
  watch();
}

// Create app.yaml from a template in dest directory.
// prefix is the app root URL prefix. Defaults to '/io2015'.
function generateAppYaml(dest, prefix, callback) {
  gulp.src(BACKEND_DIR + '/app.yaml.template', {base: BACKEND_DIR})
    .pipe($.replace(/\$PREFIX\$/g, prefix))
    .pipe($.rename('app.yaml'))
    .pipe(gulp.dest(dest))
    .on('end', callback);
}

// Replace current app.yaml with the modified 'version' property.
// appYamlPath arg is optional and defaults to BACKEND_APP_YAML.
// Returns a function that restores original app.yaml content.
function changeAppYamlVersion(version, appYamlPath) {
  appYamlPath = appYamlPath || BACKEND_APP_YAML;
  var appYaml = fs.readFileSync(appYamlPath);
  fs.writeFileSync(appYamlPath, 'version: ' + version + '\n' + appYaml);
  return fs.writeFileSync.bind(fs, appYamlPath, appYaml, null);
}

// Create default server config if it doesn't exist already using the template.
// Needed to start the server.
function generateServerConfig(callback) {
  if (fs.existsSync(BACKEND_DIR + '/server.config')) {
    callback();
    return;
  }
  gulp.src(BACKEND_DIR + '/server.config.template', {base: BACKEND_DIR})
    .pipe($.rename('server.config'))
    .pipe(gulp.dest(BACKEND_DIR))
    .on('end', callback);
}

gulp.task('generate-service-worker-dev', ['sass'], function(callback) {
  del.sync([APP_DIR + '/service-worker.js']);
  var importScripts = glob.sync('scripts/shed/*.js', {cwd: APP_DIR});
  importScripts.unshift('bower_components/shed/shed.js');

  // Run with --fetch-dev to generate a service-worker.js that will handle fetch events.
  // By default, the generated service-worker.js will precache resources, but not actually serve
  // them. This is preferable for dev, since things like live reload will work as expected.
  generateServiceWorker(APP_DIR, !!argv['fetch-dev'], importScripts, function(error, serviceWorkerFileContents) {
    if (error) {
      return callback(error);
    }
    fs.writeFile(APP_DIR + '/service-worker.js', serviceWorkerFileContents, function(error) {
      if (error) {
        return callback(error);
      }
      callback();
    });
  });
});

gulp.task('generate-service-worker-dist', function(callback) {
  var distDir = DIST_STATIC_DIR + '/' + APP_DIR;
  del.sync([distDir + '/service-worker.js']);
  var importScripts = ['scripts/shed-scripts.js'];

  generateServiceWorker(distDir, true, importScripts, function(error, serviceWorkerFileContents) {
    if (error) {
      return callback(error);
    }
    fs.writeFile(distDir + '/service-worker.js', serviceWorkerFileContents, function(error) {
      if (error) {
        return callback(error);
      }
      callback();
    });
  });
});

// Usage: gulp screenshots [--compareTo=branchOrCommit] [--pages=page1,page2,...]
//                       [widths=width1,width2,...] [height=height]
// The task performs a `git stash` prior to the checkout and then a `git stash pop` after the
// completion, but on the off chance the task ends unexpectedly, you can manually switch back to
// your current branch and run `git stash pop` to restore.
gulp.task('screenshots', ['backend'], function(callback) {
  var seleniumScreenshots = require('./gulp_scripts/selenium-screenshots');
  // We don't want the service worker to served cached content when taking screenshots.
  del.sync(APP_DIR + '/service-worker.js');

  var styleWatcher = gulp.watch([APP_DIR + '/{elements,styles}/**/*.{scss,css}'], ['sass']);
  var callbackWrapper = function(error) {
    styleWatcher.end();
    callback(error);
  };

  var allPages = glob.sync(APP_DIR + '/templates/!(layout_).html').map(function(templateFile) {
    return path.basename(templateFile).replace('.html', '');
  });

  var branchOrCommit = argv.compareTo || 'master';
  var pages = argv.pages ? argv.pages.split(',') : allPages;
  var widths = argv.widths ?
    // widths is coerced into a Number unless there's a comma, and only strings can be split().
    (argv.widths.split ? argv.widths.split(',').map(Number) : [argv.widths]) :
    [400, 900, 1200];
  var height = argv.height || 9999;
  seleniumScreenshots(branchOrCommit, APP_DIR, 'http://localhost:9999' + URL_PREFIX + '/',
    pages, widths, height, callbackWrapper);
});
