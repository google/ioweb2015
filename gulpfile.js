/* jshint node: true */

'use strict';

var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var pagespeed = require('psi');
var path = require('path');
var del = require('del');
var i18n_replace = require('./gulp_scripts/i18n_replace');
var runSequence = require('run-sequence');
var argv = require('yargs').argv;
var browserSync = require('browser-sync');
var reload = browserSync.reload;
var bower = require('gulp-bower');

var APP_DIR = 'app';

var STATIC_VERSION = 1; // Cache busting static assets.
var VERSION = argv.build || STATIC_VERSION;

// TODO(ericbidelman|bckenny): fill in with default static asset base URL
// var STATIC_BASE_URL = argv.baseurl ? argv.baseurl : '';
// var STATIC_URL = argv.pretty ? '' : (STATIC_BASE_URL + VERSION + '/');

var DIST_STATIC_DIR = 'dist';
// var PROD_DIR = APP_DIR + '/dist_prod';
// var STATIC_DIR = APP_DIR + '/dist_static';
// var PRETTY_DIR = APP_DIR + '/dist_pretty';

// path for files (mostly index_*.html) with short cache periods
// var DIST_PROD_DIR = argv.pretty ? PRETTY_DIR : PROD_DIR;

// path for static resources
// var DIST_STATIC_DIR = argv.pretty ? PRETTY_DIR : (STATIC_DIR + '/' + VERSION);

// TODO(ericbidelman): also remove generated .css files.
gulp.task('clean', function(cleanCallback) {
  del([DIST_STATIC_DIR], cleanCallback);
});

gulp.task('compass', function() {
  return gulp.src([
      APP_DIR + '/{styles,elements}/**/*.scss'
    ])
    .pipe($.compass({
      project: path.join(__dirname, '/' + APP_DIR),
      css: '',
      sass: '',
      environment: 'production',
    }))
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
    // .pipe(gulp.dest('.'))
    .pipe($.size({title: 'styles'}));
});

// Copy Web Fonts To Dist
gulp.task('fonts', function () {
  return gulp.src([APP_DIR + '/fonts/**'])
    .pipe(gulp.dest(DIST_STATIC_DIR + '/' + APP_DIR + '/fonts'))
    .pipe($.size({title: 'fonts'}));
});

// gulp.task('vulcanize-scenes', ['clean', 'compass', 'compile-scenes'], function() {
//   return gulp.src([
//       'scenes/*/*-scene*.html'
//     ], {base: './'})
//     // gulp-vulcanize doesn't currently handle multiple files in multiple
//     // directories well right now, so vulcanize them one at a time
//     .pipe($.foreach(function(stream, file) {
//       var dest = path.dirname(path.relative(__dirname, file.path));
//       return stream.pipe($.vulcanize({
//         excludes: {
//           // these are inlined in elements.html
//           imports: [
//             'jquery.html$',
//             'modernizr.html$',
//             'polymer.html$',
//             'base-scene.html$',
//             'i18n-msg.html$',
//             'core-a11y-keys.html$',
//             'core-shared-lib.html$',
//             'google-maps-api.html$',
//           ]
//         },
//         strip: !argv.pretty,
//         csp: true,
//         inline: true,
//         dest: dest
//       }))
//       .pipe(i18n_replace({
//         strict: !!argv.strict,
//         path: '_messages',
//       }))
//       .pipe(gulp.dest(path.join(DIST_STATIC_DIR, dest)));
//     }));
// });

// vulcanize main site elements separately.
gulp.task('vulcanize-elements', ['clean', 'compass'], function() {
  return gulp.src([
      APP_DIR + '/elements/elements.html'
    ], {base: './'})
    .pipe($.vulcanize({
      strip: !argv.pretty,
      csp: true,
      inline: true,
      dest: 'elements/'
    }))
    // .pipe(i18n_replace({
    //   strict: !!argv.strict,
    //   path: '_messages',
    // }))
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
// gulp.task('copy-assets', ['clean', 'vulcanize', 'i18n_index'], function() {
  gulp.task('copy-assets', function() {
  return gulp.src([
    APP_DIR + '/*.{html,txt,ico}',
    APP_DIR + '/app.yaml',
    APP_DIR + '/manifest.json',
    APP_DIR + '/styles/**.css',
    APP_DIR + 'elements/**/images/*',
    APP_DIR + '/bower_components/webcomponentsjs/webcomponents.min.js'
  ], {base: './'})
  .pipe(gulp.dest(DIST_STATIC_DIR))
  .pipe($.size({title: 'copy-assets'}));
});

// Lint JavaScript
gulp.task('jshint', function() {
  return gulp.src([APP_DIR + '/scripts/**/*.js', '!**/third_party/**'])
    .pipe(reload({stream: true, once: true}))
    .pipe($.jshint())
    .pipe($.jshint.reporter('jshint-stylish'))
    .pipe($.if(!browserSync.active, $.jshint.reporter('fail')));
});

// Check JS style
gulp.task('jscs', function() {
  return gulp.src([APP_DIR + '/scripts/**/*.js', '!**/third_party/**'])
    .pipe(reload({stream: true, once: true}))
    .pipe($.jscs());
});

// Crush JS
gulp.task('uglify', function() {
  return gulp.src(APP_DIR + '/scripts/**/*.js')
    .pipe(reload({stream: true, once: true}))
    .pipe($.uglify({preserveComments: 'some'}))
    .pipe(gulp.dest(DIST_STATIC_DIR + '/' + APP_DIR + '/scripts'))
    .pipe($.size({title: 'uglify'}));
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

// Watch Files For Changes & Reload
gulp.task('serve', ['compass'], function() {
  browserSync({
    notify: false,
    // Run as an https by uncommenting 'https: true'
    // Note: this uses an unsigned certificate which on first access
    //       will present a certificate warning in the browser.
    // https: true,
    server: [APP_DIR]
  });

  gulp.watch([APP_DIR + '/**/*.html'], reload);
  gulp.watch([APP_DIR + '/styles/**/*.{scss,css}'], ['styles', reload]);
  gulp.watch([APP_DIR + '/scripts/**/*.js'], ['jshint']);
  gulp.watch([APP_DIR + '/images/**/*'], reload);
  gulp.watch([APP_DIR + '/bower.json'], ['bower']);
});

gulp.task('vulcanize', ['vulcanize-elements']);

gulp.task('js', ['jshint', 'jscs', 'uglify']);

gulp.task('default', ['clean'], function(cb) {
  runSequence('compass', 'vulcanize', ['js', 'images', 'fonts', 'copy-assets'], cb);
});

gulp.task('bower', function() {
  return bower({ cwd: APP_DIR });
});

gulp.task('setup', function(cb) {
  runSequence('bower', 'default', cb);
});

// Load custom tasks from the `tasks` directory
try { require('require-dir')('tasks'); } catch (err) {}
