// TODO (jeffposnick): Reach out to inexorabletash (Joshua Bell) about making this into a package
// that we can install in a standard location and add to the dependencies.
importScripts('scripts/third_party/simpledb_polyfill.js');

var DB_NAME = 'shed-offline-analytics';
var EXPIRATION_TIME_DELTA = 86400000; // One day, in milliseconds.

function replayQueuedRequests() {
  simpleDB.open(DB_NAME).then(function(db) {
    db.forEach(function(url) {
      db.get(url).then(function(originalTimestamp) {
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

// TODO (jeffposnick): Is there any way to use wildcards for the protocols and domains?
// TODO (jeffposnick): See if there's a way to avoid :ignored. See https://github.com/wibblymat/shed/issues/17
shed.router.get('http://www.google-analytics.com/collect?:ignored', handleAnalyticsCollectionRequest);
shed.router.get('https://www.google-analytics.com/collect?:ignored', handleAnalyticsCollectionRequest);
shed.router.get('https://ssl.google-analytics.com/collect?:ignored', handleAnalyticsCollectionRequest);

shed.router.get('http://www.google-analytics.com/analytics.js', shed.networkFirst);
shed.router.get('https://www.google-analytics.com/analytics.js', shed.networkFirst);

replayQueuedRequests();
