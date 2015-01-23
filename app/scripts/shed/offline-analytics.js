// From https://gist.github.com/inexorabletash/c8069c042b734519680c (Joshua Bell)

(function(global) {
  var SECRET = Object.create(null);
  var DB_PREFIX = '$SimpleDB$';
  var STORE = 'store';

  function SimpleDBFactory(secret) {
    if (secret !== SECRET) throw TypeError('Invalid constructor');
  }
  SimpleDBFactory.prototype = {
    open: function(name) {
      return new Promise(function(resolve, reject) {
        var request = indexedDB.open(DB_PREFIX + name);
        request.onupgradeneeded = function() {
          var db = request.result;
          db.createObjectStore(STORE);
        };
        request.onsuccess = function() {
          var db = request.result;
          resolve(new SimpleDB(SECRET, name, db));
        };
        request.onerror = function() {
          reject(request.error);
        };
      });
    },
    delete: function(name) {
      return new Promise(function(resolve, reject) {
        var request = indexedDB.deleteDatabase(DB_PREFIX + name);
        request.onsuccess = function() {
          resolve(undefined);
        };
        request.onerror = function() {
          reject(request.error);
        };
      });
    }
  };

  function SimpleDB(secret, name, db) {
    if (secret !== SECRET) throw TypeError('Invalid constructor');
    this._name = name;
    this._db = db;
  }
  SimpleDB.cmp = indexedDB.cmp;
  SimpleDB.prototype = {
    get name() {
      return this._name;
    },
    get: function(key) {
      var that = this;
      return new Promise(function(resolve, reject) {
        var tx = that._db.transaction(STORE, 'readwrite');
        var store = tx.objectStore(STORE);
        var req = store.get(key);
        // NOTE: Could also use req.onsuccess/onerror
        tx.oncomplete = function() { resolve(req.result); };
        tx.onabort = function() { reject(tx.error); };
      });
    },
    set: function(key, value) {
      var that = this;
      return new Promise(function(resolve, reject) {
        var tx = that._db.transaction(STORE, 'readwrite');
        var store = tx.objectStore(STORE);
        var req = store.put(value, key);
        tx.oncomplete = function() { resolve(undefined); };
        tx.onabort = function() { reject(tx.error); };
      });
    },
    delete: function(key) {
      var that = this;
      return new Promise(function(resolve, reject) {
        var tx = that._db.transaction(STORE, 'readwrite');
        var store = tx.objectStore(STORE);
        var req = store.delete(key);
        tx.oncomplete = function() { resolve(undefined); };
        tx.onabort = function() { reject(tx.error); };
      });
    },
    clear: function() {
      var that = this;
      return new Promise(function(resolve, reject) {
        var tx = that._db.transaction(STORE, 'readwrite');
        var store = tx.objectStore(STORE);
        var request = store.clear();
        tx.oncomplete = function() { resolve(undefined); };
        tx.onabort = function() { reject(tx.error); };
      });
    },
    forEach: function(callback, options) {
      var that = this;
      return new Promise(function(resolve, reject) {
        options = options || {};
        var tx = that._db.transaction(STORE, 'readwrite');
        var store = tx.objectStore(STORE);
        var request = store.openCursor(
          options.range,
          options.direction === 'reverse' ? 'prev' : 'next');
        request.onsuccess = function() {
          var cursor = request.result;
          if (!cursor) return;
          try {
            var terminate = callback(cursor.key, cursor.value);
            if (!terminate) cursor.continue();
          } catch (ex) {
            tx.abort(); // ???
          }
        };
        tx.oncomplete = function() { resolve(undefined); };
        tx.onabort = function() { reject(tx.error); };
      });
    },
    getMany: function(keys) {
      var that = this;
      return new Promise(function(resolve, reject) {
        var tx = that._db.transaction(STORE, 'readwrite');
        var store = tx.objectStore(STORE);
        var results = [];
        keys.forEach(function(key) {
          store.get(key).onsuccess(function(result) {
            results.push(result);
          });
        });
        tx.oncomplete = function() { resolve(results); };
        tx.onabort = function() { reject(tx.error); };
      });
    },
    setMany: function(entries) {
      var that = this;
      return new Promise(function(resolve, reject) {
        var tx = that._db.transaction(STORE, 'readwrite');
        var store = tx.objectStore(STORE);
        entries.forEach(function(entry) {
          store.put(entry.value, entry.key);
        });
        tx.oncomplete = function() { resolve(undefined); };
        tx.onabort = function() { reject(tx.error); };
      });
    },
    deleteMany: function(keys) {
      var that = this;
      return new Promise(function(resolve, reject) {
        var tx = that._db.transaction(STORE, 'readwrite');
        var store = tx.objectStore(STORE);
        keys.forEach(function(key) {
          store.delete(key);
        });
        tx.oncomplete = function() { resolve(undefined); };
        tx.onabort = function() { reject(tx.error); };
      });
    }
  };

  global.simpleDB = new SimpleDBFactory(SECRET);
  global.SimpleDBKeyRange = IDBKeyRange;
}(self));

var DB_NAME = 'shed-offline-analytics';
var EXPIRATION_TIME_DELTA = 86400000; // One day, in milliseconds.
var ORIGIN = /https?:\/\/((www|ssl)\.)?google-analytics\.com/;

function replayQueuedRequests() {
  simpleDB.open(DB_NAME).then(function(db) {
    db.forEach(function(url, originalTimestamp) {
      var timeDelta = Date.now() - originalTimestamp;
      // See https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#qt
      var replayUrl = url + '&qt=' + timeDelta;

      console.log('About to replay:', replayUrl);
      fetch(replayUrl).then(function(response) {
        if (response.status >= 500) {
          // This will cause the promise to reject, triggering the .catch() function.
          return Response.error();
        }

        console.log('Replay succeeded:', replayUrl);
        db.delete(url);
      }).catch(function(error) {
        if (timeDelta > EXPIRATION_TIME_DELTA) {
          // After a while, Google Analytics will no longer accept an old ping with a qt=
          // parameter. The advertised time is ~4 hours, but we'll attempt to resend up to 24
          // hours. This logic also prevents the requests from being queued indefinitely.
          console.error('Replay failed, but the original request is too old to retry any further. Error:', error);
          db.delete(url);
        } else {
          console.error('Replay failed, and will be retried the next time the service worker starts. Error:', error);
        }
      });
    });
  });
}

function queueFailedRequest(request) {
  console.log('Queueing failed request:', request);

  simpleDB.open(DB_NAME).then(function(db) {
    db.set(request.url, Date.now());
  });
}

function handleAnalyticsCollectionRequest(request) {
  return fetch(request).then(function(response) {
    if (response.status >= 500) {
      // This will cause the promise to reject, triggering the .catch() function.
      // It will also result in a generic HTTP error being returned to the controlled page.
      return Response.error();
    } else {
      return response;
    }
  }).catch(function() {
    queueFailedRequest(request);
  });
}

shed.router.get('/collect', handleAnalyticsCollectionRequest, {origin: ORIGIN});
shed.router.get('/analytics.js', shed.networkFirst, {origin: ORIGIN});

replayQueuedRequests();
