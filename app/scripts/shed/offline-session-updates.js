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

(function(global) {
  var QUEUED_SESSION_UPDATES_DB_NAME = 'shed-offline-session-updates';

  function queueFailedSessionUpdateRequest(request) {
    console.log('Queueing failed request:', request);

    global.simpleDB.open(QUEUED_SESSION_UPDATES_DB_NAME).then(function(db) {
      // The request.url is used as the key, with the method as the value.
      // The request URL includes the session id.
      // This means that only the last failed update for a given URL will be queued, which is the
      // behavior we want—if someone DELETEs a session and then PUTs the same session, and both fail,
      // then we want the PUT to be replayed.
      db.set(request.url, request.method);
    });
  }

  function handleSessionUpdateRequest(request) {
    return global.fetch(request).then(function(response) {
      if (response.status >= 500) {
        // This will cause the promise to reject, triggering the .catch() function.
        // It will also result in a generic HTTP error being returned to the controlled page.
        return Response.error();
      } else {
        return response;
      }
    }).catch(function() {
      queueFailedSessionUpdateRequest(request);
    });
  }

  global.shed.router.put('/(.+)api/v1/user/schedule/(.+)', handleSessionUpdateRequest);
  global.shed.router.delete('/(.+)api/v1/user/schedule/(.+)', handleSessionUpdateRequest);
})(self);
