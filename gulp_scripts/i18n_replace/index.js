/* jshint node: true */

var dir = require('node-dir');
var through = require('through2');
var path = require('path');
var gutil = require('gulp-util');
var format = require('sprintf-js').sprintf;

var REGEX = /<i18n-msg msgid="([^"]*)">([^<]*)<\/i18n-msg>/gm;

module.exports = function replaceMessages(opts) {
  var warn = warnFunc(opts.strict);
  var msgPromise = getMsgs(opts.path);

  var stream = through.obj(function(file, enc, cb) {
    // TODO(cbro): only read HTML files.
    if (file.isNull()) return stream.push(file);
    if (file.isStream()) error('No support for streams');

    msgPromise.then(function(messagesByLang) {
      var src = file.contents.toString();
      var langs = Object.keys(messagesByLang);
      // Force en to be last. gulp halts execution because we push a file to the
      // stream with the same path.
      langs = langs.filter(function(l) { return l != 'en' });
      langs.push('en');

      for (var i = 0; i < langs.length; i++) {
        var lang = langs[i];
        var msgs = messagesByLang[lang];
        if (!msgs) {
          error('No messages for lang: %s', lang);
        }

        var ext = '_' + lang + '.html';
        var replaced = src
          .replace(/lang="en"/, 'lang="' + lang + '"')
          .replace(/_en\.html/mg, ext)
          .replace(REGEX, function replacer(match, msgid, tagBody) {
            var msg = msgs[msgid];
            if (!msg) {
              warn('[%s %6s] Could not find message %s.', file.relative, lang, msgid);
              var fallback = messagesByLang.en[msgid];
              if (lang == 'fr-CA') {
                fallback = messagesByLang.fr[msgid] || fallback
              }
              return fallback ? fallback.message: 'MESSAGE_NOT_FOUND';
            }
            if (lang == 'en' && 'PLACEHOLDER_i18n' != tagBody) {
              error('i18n-msg body must be "PLACEHOLDER_i18n" for %s in %s', msgid, file.relative);
            }
            return msg.message
          });

        if (replaced == src) {
          // Don't create a new file if the source didn't change.
          stream.push(file);
          break;
        }
        if (!file.path.match(/(index|error|upgrade|_en)\.html$/)) {
          error('[%s] Files with i18n-msg should end in _en.html', file.relative);
        }

        var dir = '/';
        // Only root pages should go in /intl/ directories.
        if (lang != 'en' && !file.path.match(/_en\.html$/)) {
          dir = '/intl/' + lang + '_ALL/';
        }
        var i18nfile = file.clone();
        i18nfile.path = path.dirname(file.path) + dir +
            path.basename(file.path).replace(/_en.html$/, ext);
        i18nfile.contents = new Buffer(replaced);

        stream.push(i18nfile);
      }
      cb();
    });
  });

  return stream;
};

/**
 * Read messages from _messages/*.json into a map.
 * Returns a promise-like object.
 */
function getMsgs(msgDir) {
  // map: locale -> message ID -> message object (description/message)
  var msgs = {};
  var done = false;
  var callbacks = [];

  dir.readFiles(msgDir, function(err, content, filename, next) {
    if (err) throw err;

    var lang = path.basename(filename, '.json');
    msgs[lang] = JSON.parse(content);
    next();
  },
  function(err) {
    if (err) throw err;
    done = true;
    while (callbacks.length) {
      callbacks.pop()(msgs);
    }
  });

  return {
    then: function(callback) {
      if (!done) {
        callbacks.push(callback);
      } else {
        callback(msgs);
      }
    }
  };
}

function warnFunc(strict) {
  return function(var_args) {
    var message = format.apply(this, arguments);
    if (strict) {
      throw new gutil.PluginError('i18n_replace', message);
    } else {
      gutil.log('WARNING[i18n_replace]:', message);
    }
  }
}

function error(var_args) {
  var message = format.apply(this, arguments);
  throw new gutil.PluginError('i18n_replace', message);
}
